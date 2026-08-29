"""Resume diff generation using nanobot's agent runtime."""

from __future__ import annotations

import asyncio
import json
from typing import Any

from nanobot import Nanobot
from nanobot.agent.loop import AgentLoop
from nanobot.config.loader import resolve_config_env_vars
from nanobot.config.schema import Config

from ..config import build_nanobot_config, get_default_model, get_provider_name
from ..logger import log_event
from ..schemas import (
    ChatMessage,
    LlmProvider,
    LlmUsage,
    ResumeDiffRequest,
    ResumeDiffResults,
)
from ..utils import parse_resume_diffs, with_timeout


_RESUME_DIFF_SYSTEM_PROMPT = """\
You are a JSON patch generator for a resume editor. You must return one JSON object only:
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


def _build_messages(
    request: ResumeDiffRequest,
    resume_context: str,
    path_index: str,
) -> list[dict[str, str]]:
    history = request.conversationHistory or []
    history_text = "\n\n".join(
        f"{msg.role.upper()}: {msg.content}"
        for msg in history[-6:]
    ) or "(none)"

    system = f"""{_RESUME_DIFF_SYSTEM_PROMPT}

Allowed class names: {', '.join(request.allowClassNames or [])}

Recent chat history:
{history_text}

Relevant node path index. Prefer exact paths from this list for existing text and classed nodes:
{path_index}

Relevant resume nodes:
{resume_context}
"""

    user = f"""Instruction: {request.instruction}

Return only this JSON object shape:
{{"diffs":[{{"op":"replace","path":"/tree/root/.../value","value":"..."}}]}}
"""

    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


def _build_path_index(resume_context: Any) -> str:
    if not isinstance(resume_context, list) or not resume_context:
        return "No relevant resume nodes were selected."

    lines: list[str] = []
    lines.append("Text value paths:")
    for node in resume_context:
        _collect_text_paths(node, node.get("wd", "/tree/root"), lines)

    lines.append("Classed node paths:")
    for node in resume_context:
        _collect_classed_node_paths(node, node.get("wd", "/tree/root"), lines)

    return "\n".join(lines)


def _collect_text_paths(node: Any, fallback_wd: str, lines: list[str]) -> None:
    wd = node.get("wd") or fallback_wd
    if node.get("type") == "text":
        lines.append(f'{wd}/value = {json.dumps(node.get("value", ""))}')
        return

    for index, child in enumerate(node.get("children", [])):
        _collect_text_paths(child, f"{wd}/children/{index}", lines)


def _collect_classed_node_paths(node: Any, fallback_wd: str, lines: list[str]) -> None:
    wd = node.get("wd") or fallback_wd
    if node.get("type") == "element":
        class_name = node.get("attributes", {}).get("class")
        if class_name:
            tag = node.get("tagName", "element")
            lines.append(f'{wd} <{tag} class={json.dumps(class_name)}>')

    for index, child in enumerate(node.get("children", [])):
        _collect_classed_node_paths(child, f"{wd}/children/{index}", lines)


def _parse_resume_context(request: ResumeDiffRequest) -> Any:
    """Best-effort parse the resume DOM/structure into a node tree."""
    for raw in (request.resumeDom, request.resumeStructure, request.resumeSummary):
        if not raw:
            continue
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, (dict, list)):
                return parsed
        except json.JSONDecodeError:
            continue
    return None


def _map_usage(usage: dict[str, Any] | None) -> LlmUsage:
    if not usage:
        return LlmUsage()
    return LlmUsage(
        promptEvalCount=usage.get("prompt_tokens") or usage.get("promptEvalCount"),
        evalCount=usage.get("completion_tokens") or usage.get("evalCount"),
        totalDuration=usage.get("total_duration") or usage.get("totalDuration"),
        loadDuration=usage.get("load_duration") or usage.get("loadDuration"),
        promptEvalDuration=usage.get("prompt_eval_duration")
        or usage.get("promptEvalDuration"),
        evalDuration=usage.get("eval_duration") or usage.get("evalDuration"),
    )


def _provider_name_to_enum(name: str) -> LlmProvider:
    if name.lower() == "openai":
        return LlmProvider.OPENAI
    return LlmProvider.OLLAMA


class ResumeDiffAgent:
    """Thin wrapper around nanobot that generates resume diff operations."""

    def __init__(self, config: Config | None = None) -> None:
        self.config = config or build_nanobot_config()
        self._bot: Nanobot | None = None

    async def _get_bot(self) -> Nanobot:
        if self._bot is None:
            resolved = resolve_config_env_vars(self.config)
            loop = AgentLoop.from_config(resolved)
            self._bot = Nanobot(loop, config=resolved)
        return self._bot

    async def generate(
        self,
        request: ResumeDiffRequest,
        request_id: str,
    ) -> ResumeDiffResults:
        resume_context = _parse_resume_context(request)
        path_index = _build_path_index(resume_context)
        messages = _build_messages(request, json.dumps(resume_context), path_index)

        log_event(
            "resume_diff_prompt_ready",
            {
                "requestId": request_id,
                "promptChars": sum(len(m["content"]) for m in messages),
                "resumeContextChars": len(json.dumps(resume_context)),
                "pathIndexChars": len(path_index),
            },
        )

        bot = await self._get_bot()
        # The nanobot high-level SDK only exposes a single user message for
        # ephemeral runs, so we prepend the system instructions to the user
        # content to preserve the full prompt context.
        prompt = f"{messages[0]['content']}\n\n{messages[-1]['content']}"

        try:
            result = await with_timeout(
                bot.run(
                    prompt,
                    session_key=f"resume-diff:{request_id}",
                    ephemeral=True,
                ),
                timeout_ms=60_000,
                message="Resume diff generation timed out after 60000ms.",
            )
        except asyncio.TimeoutError as exc:
            raise TimeoutError("Resume diff generation timed out.") from exc

        raw_content = result.content
        log_event(
            "resume_diff_llm_raw",
            {"requestId": request_id, "rawContent": raw_content},
        )

        diffs = parse_resume_diffs(raw_content)
        log_event(
            "resume_diff_llm_finished",
            {"requestId": request_id, "diffCount": len(diffs), "rawContent": raw_content},
        )

        provider_name = get_provider_name()
        return ResumeDiffResults(
            ok=True,
            diffs=diffs,
            provider=_provider_name_to_enum(provider_name),
            model=get_default_model(),
            note=f"Generated {len(diffs)} resume diff{'s' if len(diffs) != 1 else ''}.",
            usage=_map_usage(dict(result.usage) if result.usage else None),
        )

    async def close(self) -> None:
        if self._bot is not None:
            await self._bot.aclose()
            self._bot = None
