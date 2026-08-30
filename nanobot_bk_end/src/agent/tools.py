"""Custom nanobot tools for the resume-diff workflow."""

from __future__ import annotations

import json
from typing import Any

from nanobot.agent.tools.base import Tool, ToolResult, tool_parameters
from nanobot.agent.tools.schema import (
    ArraySchema,
    ObjectSchema,
    StringSchema,
    tool_parameters_schema,
)
from nanobot.utils.llm_runtime import LLMRuntime

from ..logger import log_event
from ..schemas import ChatMessage, LlmProvider, ResumeDiffRequest, ResumeDiffResults
from ..utils import extract_json, parse_resume_diffs
from .state import get_state


INTENT_CLASSIFIER_SYSTEM = """\
You classify resume edit requests for a JSON Patch generator.
Return one JSON object only. Do not generate patches.

Allowed intents:
- visual: presentation-only edits such as layout, spacing, colors, fonts, columns, width, height.
- content: resume text or semantic document structure edits.
- mixed: both content/structure and visual presentation are requested.
- page_clone_translate: request asks for an additional copied/translated page or version.
- ambiguous: intent is unclear.

Allowed surfaces:
- styles: visual presentation under /styles.
- tree: resume content and DOM-like structure under /tree.

Return this exact shape:
{"intent":"visual|content|mixed|page_clone_translate|ambiguous","surfaces":["styles"],"confidence":0.0,"guidance":"one concise instruction for the patch generator"}

Guidance rules:
- visual: tell the generator to prefer small /styles diffs on existing selectors.
- content: tell the generator to prefer precise /tree diffs.
- mixed: tell the generator to use /tree for content/structure and /styles for presentation.
- page_clone_translate: tell the generator to copy the existing page/container first, then replace copied text fields.
- ambiguous: tell the generator to choose the smallest valid diffs and use /styles only for presentation.
"""


DIFF_GENERATOR_INTRO = """\
You are a JSON patch generator. You must return one JSON object only:
{"diffs":[...]}

Each item in diffs is a JSON Patch operation for the provided Resume object.
Allowed ops: add, remove, replace, move, copy, test.
Use exact paths from the path index when possible.
Use plain slash paths like /tree/root/children/0/value.
The provided node context is intentionally partial. Do not invent tree paths outside the path index unless copying an existing shown page/container to the next array index.
For text edits, use exact entries from "Text value paths"; do not append /value to a classed element path unless that exact /value path appears in the index.
Use /tree paths for resume content and structure: text, sections, list items, adding/removing/reordering actual resume elements.
When duplicating an existing page, section, item, or translated version, prefer copy from the existing node, then replace the copied text fields.
Use add only for genuinely new content that cannot be copied from an existing structure.
Do not replace large children arrays when a smaller text, node-field, or style diff can satisfy the request.
No markdown, no prose, no HTML snippets.
Do not replace/remove the root object.
Do not create script/style/iframe/object/embed nodes, event attrs, or javascript: URLs.
"""


def _history_text(history: list[ChatMessage] | None) -> str:
    if not history:
        return "(none)"
    return "\n\n".join(
        f"{msg.role.upper()}: {msg.content}" for msg in history[-6:]
    )


def _parse_intent_json(raw: str) -> dict[str, Any]:
    parsed = json.loads(extract_json(raw))
    if not isinstance(parsed, dict):
        raise ValueError("Intent classifier output must be an object.")
    intent = parsed.get("intent")
    surfaces = parsed.get("surfaces")
    if intent not in {
        "visual",
        "content",
        "mixed",
        "page_clone_translate",
        "ambiguous",
    }:
        raise ValueError(f"Unsupported diff intent: {intent}")
    if not isinstance(surfaces, list) or not surfaces:
        raise ValueError("Intent surfaces must be a non-empty array.")
    return {
        "intent": intent,
        "surfaces": surfaces,
        "confidence": max(0.0, min(1.0, float(parsed.get("confidence", 0)))),
        "guidance": str(parsed.get("guidance", "")).strip(),
    }


@tool_parameters(
    tool_parameters_schema(
        instruction=StringSchema(
            "The user's edit instruction.",
            min_length=1,
        ),
        conversation_history=ArraySchema(
            ObjectSchema(
                {
                    "role": StringSchema("user, assistant, or system"),
                    "content": StringSchema("message content"),
                }
            ),
            description="Recent conversation history.",
        ),
        required=["instruction"],
    )
)
class ClassifyIntentTool(Tool):
    """Classify the user's resume edit intent."""

    name = "classify_intent"
    description = (
        "Analyze the user's instruction and conversation history to decide "
        "whether the request is about visual presentation, content/structure, "
        "a page clone/translation, or ambiguous. Returns intent, surfaces, "
        "confidence, and guidance for the diff generator."
    )
    read_only = True

    def __init__(self, runtime: LLMRuntime) -> None:
        self.runtime = runtime

    async def execute(
        self,
        instruction: str,
        conversation_history: list[dict[str, Any]] | None = None,
    ) -> Any:
        state = get_state()
        log_event(
            "tool_classify_intent_start",
            {"requestId": state.request_id, "instruction": instruction},
        )
        history = [
            ChatMessage(id=f"h{i}", role=msg["role"], content=msg["content"])
            for i, msg in enumerate(conversation_history or [])
            if msg.get("role") in ("user", "assistant", "system")
        ]
        history_text = _history_text(history)

        messages = [
            {
                "role": "system",
                "content": f"""{INTENT_CLASSIFIER_SYSTEM}

Recent chat history:
{history_text}
""",
            },
            {"role": "user", "content": f"Instruction: {instruction}"},
        ]

        log_event(
            "resume_diff_intent_prompt",
            {"requestId": state.request_id, "instruction": instruction},
        )

        response = await self.runtime.provider.chat(
            messages,
            model=self.runtime.model,
            max_tokens=self.runtime.generation.max_tokens or 1024,
            temperature=self.runtime.generation.temperature,
        )
        raw = response.content or ""
        log_event(
            "resume_diff_intent_raw",
            {"requestId": state.request_id, "rawContent": raw},
        )

        try:
            result = _parse_intent_json(raw)
        except Exception as exc:
            log_event(
                "tool_classify_intent_error",
                {"requestId": state.request_id, "error": str(exc)},
            )
            return ToolResult.error(
                f"Failed to parse intent classification: {exc}. Raw: {raw[:200]}"
            )

        state.intent = result
        log_event(
            "tool_classify_intent_done",
            {"requestId": state.request_id, "intent": result["intent"]},
        )
        return {
            "ok": True,
            "intent": result["intent"],
            "surfaces": result["surfaces"],
            "confidence": result["confidence"],
            "guidance": result["guidance"],
        }


@tool_parameters(
    tool_parameters_schema(
        resume_dom=StringSchema(
            "JSON string representing the current resume DOM or structure.",
        ),
        intent=StringSchema(
            "Classified intent: visual, content, mixed, page_clone_translate, or ambiguous.",
        ),
        instruction=StringSchema(
            "The user's edit instruction, used to focus context selection.",
        ),
        required=["resume_dom", "intent"],
    )
)
class BuildContextTool(Tool):
    """Build the relevant resume context and path index for the diff generator."""

    name = "build_context"
    description = (
        "Parse the resume DOM and return the subset of nodes that are relevant "
        "to the classified intent and user instruction, plus a path index that "
        "the generator should use for exact JSON Patch paths."
    )
    read_only = True

    async def execute(
        self,
        resume_dom: str,
        intent: str,
        instruction: str = "",
    ) -> Any:
        state = get_state()
        try:
            parsed = json.loads(resume_dom)
        except json.JSONDecodeError as exc:
            return ToolResult.error(f"Invalid resume DOM JSON: {exc}")

        nodes = self._select_nodes(parsed, intent, instruction)
        path_index = self._build_path_index(nodes)

        state.resume_context = nodes
        state.path_index = path_index

        return {
            "ok": True,
            "node_count": len(nodes),
            "path_index": path_index,
        }

    def _select_nodes(self, parsed: Any, intent: str, instruction: str) -> list[Any]:
        # Simplified selection: return top-level element nodes and their text children.
        # This mirrors the previous monolithic implementation; can be enhanced later.
        root = parsed.get("tree", {}).get("root") if isinstance(parsed, dict) else None
        if not isinstance(root, dict):
            return []

        candidates: list[Any] = []

        def walk(node: Any, path: str) -> None:
            if not isinstance(node, dict):
                return
            node_type = node.get("type")
            if node_type == "element":
                candidates.append({**node, "wd": node.get("wd") or path})
            for index, child in enumerate(node.get("children", [])):
                walk(child, f"{path}/children/{index}")

        for index, child in enumerate(root.get("children", [])):
            walk(child, f"/tree/root/children/{index}")

        # For page_clone_translate, include full page subtrees.
        if intent == "page_clone_translate":
            return candidates

        # For content edits, filter by instruction keywords.
        tokens = self._tokens(instruction)
        if tokens and intent in ("content", "mixed", "ambiguous"):
            matches = [
                n
                for n in candidates
                if any(t in self._node_text(n).lower() for t in tokens)
            ]
            if matches:
                return matches

        return candidates

    def _tokens(self, instruction: str) -> list[str]:
        stop = {
            "the",
            "and",
            "for",
            "with",
            "make",
            "change",
            "resume",
            "page",
            "tree",
        }
        return [
            t
            for t in instruction.lower().split()
            if len(t) >= 2 and t not in stop
        ]

    def _node_text(self, node: Any) -> str:
        if not isinstance(node, dict):
            return ""
        parts = [
            node.get("tagName", ""),
            node.get("value", ""),
            node.get("attributes", {}).get("class", ""),
            node.get("attributes", {}).get("id", ""),
        ]
        for child in node.get("children", []):
            parts.append(self._node_text(child))
        return " ".join(str(p) for p in parts)

    def _build_path_index(self, nodes: list[Any]) -> str:
        if not nodes:
            return "No relevant resume nodes were selected."

        lines = ["Text value paths:"]
        for node in nodes:
            self._collect_text_paths(node, node.get("wd", "/tree/root"), lines)

        lines.append("Classed node paths:")
        for node in nodes:
            self._collect_classed_node_paths(node, node.get("wd", "/tree/root"), lines)

        return "\n".join(lines)

    def _collect_text_paths(self, node: Any, fallback_wd: str, lines: list[str]) -> None:
        if not isinstance(node, dict):
            return
        wd = node.get("wd") or fallback_wd
        if node.get("type") == "text":
            lines.append(f'{wd}/value = {json.dumps(node.get("value", ""))}')
            return
        for index, child in enumerate(node.get("children", [])):
            self._collect_text_paths(child, f"{wd}/children/{index}", lines)

    def _collect_classed_node_paths(
        self, node: Any, fallback_wd: str, lines: list[str]
    ) -> None:
        if not isinstance(node, dict):
            return
        wd = node.get("wd") or fallback_wd
        if node.get("type") == "element":
            class_name = node.get("attributes", {}).get("class")
            if class_name:
                tag = node.get("tagName", "element")
                lines.append(f'{wd} <{tag} class={json.dumps(class_name)}>')
        for index, child in enumerate(node.get("children", [])):
            self._collect_classed_node_paths(child, f"{wd}/children/{index}", lines)


@tool_parameters(
    tool_parameters_schema(
        instruction=StringSchema("The user's edit instruction.", min_length=1),
        intent=StringSchema(
            "Classified intent: visual, content, mixed, page_clone_translate, or ambiguous.",
        ),
        guidance=StringSchema("Guidance from the intent classifier."),
        path_index=StringSchema(
            "Path index produced by build_context; generator should prefer these paths.",
        ),
        resume_context=StringSchema(
            "JSON string of relevant resume nodes produced by build_context.",
        ),
        conversation_history=ArraySchema(
            ObjectSchema(
                {
                    "role": StringSchema("user, assistant, or system"),
                    "content": StringSchema("message content"),
                }
            ),
            description="Recent conversation history.",
        ),
        required=["instruction", "intent", "path_index"],
    )
)
class GenerateDiffTool(Tool):
    """Generate JSON Patch diffs for the resume."""

    name = "generate_diff"
    description = (
        "Call the LLM to produce a JSON object with a 'diffs' array of JSON Patch "
        "operations for the resume. Use the intent, guidance, path index, and "
        "resume context provided by the previous tools."
    )

    def __init__(self, runtime: LLMRuntime) -> None:
        self.runtime = runtime

    async def execute(
        self,
        instruction: str,
        intent: str,
        guidance: str = "",
        path_index: str = "",
        resume_context: str = "",
        conversation_history: list[dict[str, Any]] | None = None,
    ) -> Any:
        state = get_state()

        history = [
            ChatMessage(id=f"h{i}", role=msg["role"], content=msg["content"])
            for i, msg in enumerate(conversation_history or [])
            if msg.get("role") in ("user", "assistant", "system")
        ]
        history_text = _history_text(history)

        system = f"""{DIFF_GENERATOR_INTRO}

Intent guidance for this request:
Intent: {intent}
Guidance: {guidance or "Generate precise, minimal diffs."}

Recent chat history:
{history_text}

Relevant node path index. Prefer exact paths from this list for existing text and classed nodes:
{path_index}

Relevant resume nodes:
{resume_context}
"""

        user = f"""Instruction: {instruction}

Return only this JSON object shape:
{{"diffs":[{{"op":"replace","path":"/tree/root/.../value","value":"..."}}]}}
"""

        log_event(
            "resume_diff_prompt_ready",
            {
                "requestId": state.request_id,
                "intent": intent,
                "promptChars": len(system) + len(user),
                "pathIndexChars": len(path_index),
            },
        )

        response = await self.runtime.provider.chat(
            [{"role": "system", "content": system}, {"role": "user", "content": user}],
            model=self.runtime.model,
            max_tokens=self.runtime.generation.max_tokens or 4096,
            temperature=self.runtime.generation.temperature,
        )
        raw = response.content or ""
        state.raw_diff_output = raw

        log_event(
            "resume_diff_llm_raw",
            {"requestId": state.request_id, "rawContent": raw},
        )
        return {"ok": True, "raw_diffs": raw}


@tool_parameters(
    tool_parameters_schema(
        raw_diffs=StringSchema(
            "Raw JSON string returned by generate_diff.",
            min_length=1,
        ),
        required=["raw_diffs"],
    )
)
class ValidateDiffTool(Tool):
    """Parse and validate the generated JSON diffs."""

    name = "validate_diff"
    description = (
        "Parse the raw diff JSON from generate_diff and validate that each op, "
        "path, and value is legal. If validation fails, return a detailed error "
        "so generate_diff can be called again with corrections."
    )
    read_only = True

    async def execute(self, raw_diffs: str) -> Any:
        state = get_state()
        try:
            diffs = parse_resume_diffs(raw_diffs)
        except Exception as exc:
            state.validation_error = str(exc)
            return ToolResult.error(
                f"Diff validation failed: {exc}. Please call generate_diff again "
                "with a corrected JSON Patch response."
            )

        state.validated_diffs = diffs
        state.validation_error = None
        return {"ok": True, "diff_count": len(diffs), "diffs": diffs}


@tool_parameters(
    tool_parameters_schema(
        diffs=ArraySchema(
            ObjectSchema(additional_properties=True),
            description="Validated diff operations to finalize.",
        ),
        required=["diffs"],
    )
)
class FinalizeDiffTool(Tool):
    """Finalize the validated diffs and end the agent run."""

    name = "finalize_diff"
    description = (
        "Call this tool when the diffs have been validated successfully. It "
        "stores the final result and ends the workflow."
    )

    async def execute(self, diffs: list[dict[str, Any]]) -> Any:
        state = get_state()
        state.validated_diffs = diffs

        from ..config import get_default_model, get_provider_name

        provider_name = get_provider_name()
        provider_enum = LlmProvider.OPENAI if provider_name == "openai" else LlmProvider.OLLAMA
        state.final_result = ResumeDiffResults(
            ok=True,
            diffs=diffs,
            provider=provider_enum,
            model=get_default_model(),
            note=f"Generated {len(diffs)} resume diff{'s' if len(diffs) != 1 else ''}.",
        )
        return {
            "ok": True,
            "message": "Diffs finalized.",
            "diff_count": len(diffs),
        }
