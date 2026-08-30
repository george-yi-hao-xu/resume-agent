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
from ..schemas import ChatMessage, LlmProvider, ResumeDiffResults
from ..utils import parse_resume_diffs
from .state import get_state

DIFF_GENERATOR_INTRO = """\
You are a JSON patch generator. You must return one JSON object only:
{"diffs":[...]}

Each item in diffs is a JSON Patch operation for the provided Resume object.
Allowed ops: add, remove, replace, move, copy, test.
Use exact paths from the path index when possible.
Use plain slash paths like /tree/root/children/0/value.
The provided node context is intentionally partial.
Do not invent tree paths outside the path index.
Exception: copying an existing shown page/container to the next array index.
For text edits, use exact entries from "Text value paths".
Do not append /value to a classed path unless that exact path is in the index.
Use /tree paths for resume content and structure.
When duplicating a page, section, item, or translation, prefer copy.
Then replace the copied text fields.
Use add only for genuinely new content that cannot be copied from an existing structure.
Do not replace large children arrays when a smaller diff can satisfy the request.
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


def _json_tool_result(value: dict[str, Any]) -> str:
    return json.dumps(value, ensure_ascii=False)


@tool_parameters(
    tool_parameters_schema(
        resume_dom=StringSchema(
            "Optional JSON string representing the current resume DOM or structure.",
        ),
        instruction=StringSchema(
            "Optional edit instruction used to focus context selection.",
        ),
    )
)
class BuildContextTool(Tool):
    """Build the relevant resume context and path index for the diff generator."""

    name = "build_context"
    description = (
        "Parse the resume DOM and return resume nodes plus a path index that "
        "the generator should use for exact JSON Patch paths."
    )
    read_only = True

    async def execute(
        self,
        resume_dom: str = "",
        instruction: str = "",
    ) -> Any:
        state = get_state()
        resume_source = (
            resume_dom
            or state.request.resumeDom
            or state.request.resumeStructure
            or state.request.resumeSummary
            or "{}"
        )
        effective_instruction = instruction or state.request.instruction
        try:
            parsed = json.loads(resume_source)
        except json.JSONDecodeError as exc:
            return ToolResult.error(f"Invalid resume DOM JSON: {exc}")

        nodes = self._select_nodes(parsed, effective_instruction)
        path_index = self._build_path_index(nodes)
        resume_context = json.dumps(nodes, ensure_ascii=False)

        state.resume_context = nodes
        state.path_index = path_index

        return _json_tool_result(
            {
                "ok": True,
                "node_count": len(nodes),
                "path_index": path_index,
                "resume_context": resume_context,
            }
        )

    def _select_nodes(self, parsed: Any, instruction: str) -> list[Any]:
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

        # Prefer focused context when instruction terms match existing nodes,
        # otherwise return all candidates so edits are not blocked by guessing.
        tokens = self._tokens(instruction)
        if tokens:
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

    def _collect_text_paths(
        self,
        node: Any,
        fallback_wd: str,
        lines: list[str],
    ) -> None:
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
        path_index=StringSchema(
            "Optional path index produced by build_context.",
        ),
        resume_context=StringSchema(
            "Optional JSON string of relevant resume nodes produced by build_context.",
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
    )
)
class GenerateDiffTool(Tool):
    """Generate JSON Patch diffs for the resume."""

    name = "generate_diff"
    description = (
        "Call the LLM to produce a JSON object with a 'diffs' array of JSON Patch "
        "operations for the resume. Use the path index and resume context "
        "provided by build_context."
    )

    def __init__(self, runtime: LLMRuntime) -> None:
        self.runtime = runtime

    async def execute(
        self,
        instruction: str = "",
        path_index: str = "",
        resume_context: str = "",
        conversation_history: list[dict[str, Any]] | None = None,
    ) -> Any:
        state = get_state()
        effective_instruction = instruction or state.request.instruction
        effective_path_index = path_index or state.path_index
        effective_resume_context = resume_context
        if not effective_resume_context and state.resume_context is not None:
            effective_resume_context = json.dumps(
                state.resume_context,
                ensure_ascii=False,
            )

        history = [
            ChatMessage(id=f"h{i}", role=msg["role"], content=msg["content"])
            for i, msg in enumerate(conversation_history or [])
            if msg.get("role") in ("user", "assistant", "system")
        ]
        history_text = _history_text(history)

        system = f"""{DIFF_GENERATOR_INTRO}

Recent chat history:
{history_text}

Relevant node path index.
Prefer exact paths from this list for existing text and classed nodes:
{effective_path_index}

Relevant resume nodes:
{effective_resume_context}
"""

        user = f"""Instruction: {effective_instruction}

Return only this JSON object shape:
{{"diffs":[{{"op":"replace","path":"/tree/root/.../value","value":"..."}}]}}
"""

        log_event(
            "resume_diff_prompt_ready",
            {
                "requestId": state.request_id,
                "promptChars": len(system) + len(user),
                "pathIndexChars": len(effective_path_index),
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
        return _json_tool_result({"ok": True, "raw_diffs": raw})


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
        return _json_tool_result(
            {"ok": True, "diff_count": len(diffs), "diffs": diffs}
        )


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
        provider_enum = (
            LlmProvider.OPENAI if provider_name == "openai" else LlmProvider.OLLAMA
        )
        state.final_result = ResumeDiffResults(
            ok=True,
            diffs=diffs,
            provider=provider_enum,
            model=get_default_model(),
            note=f"Generated {len(diffs)} resume diff{'s' if len(diffs) != 1 else ''}.",
        )
        return _json_tool_result(
            {
                "ok": True,
                "message": "Diffs finalized.",
                "diff_count": len(diffs),
            }
        )
