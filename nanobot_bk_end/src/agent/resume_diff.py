"""Resume diff generation using nanobot's AgentRunner + custom tools."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from nanobot.agent.memory import MemoryStore
from nanobot.agent.runner import AgentRunner, AgentRunSpec
from nanobot.agent.tools.registry import ToolRegistry
from nanobot.config.schema import Config
from nanobot.providers.factory import make_provider
from nanobot.utils.llm_runtime import LLMRuntime

from ..config import build_nanobot_config, get_default_model, get_provider_name
from ..logger import log_event
from ..schemas import (
    ChatMessage,
    ChatRole,
    LlmProvider,
    LlmUsage,
    ResumeDiffRequest,
    ResumeDiffResults,
)
from ..utils import extract_json
from .state import ResumeDiffState, set_state
from .tools import (
    BuildContextTool,
    ClassifyIntentTool,
    FinalizeDiffTool,
    GenerateDiffTool,
    ValidateDiffTool,
)

_MAX_PERSISTED_HISTORY_ENTRIES = 20


def _memory_workspace() -> Path:
    """Return the nanobot memory workspace directory.

    Defaults to the backend directory so that ``memory/`` is kept inside
    ``nanobot_bk_end/``. Override with ``NANOBOT_MEMORY_WORKSPACE``.
    """
    custom = os.environ.get("NANOBOT_MEMORY_WORKSPACE")
    if custom:
        return Path(custom).expanduser().resolve()
    return Path(__file__).resolve().parents[2]


AGENT_SYSTEM_PROMPT = """\
You are a resume editing assistant. Produce a valid JSON Patch diff for the resume.

You must follow this workflow:
1. Call `classify_intent` to understand the request.
2. Call `build_context` to get relevant resume nodes and a path index.
3. Call `generate_diff` to ask the LLM to produce JSON Patch diffs.
4. Call `validate_diff` to parse and validate the raw diffs.
5. If validation fails, inspect the error and retry `generate_diff` up to 2 times.
6. Once validation succeeds, call `finalize_diff` with the validated diffs and stop.

Rules:
- Do not output final JSON in text. Always use `finalize_diff`.
- If intent is "ambiguous", still generate minimal, safe diffs.
- Keep diffs small. Prefer replacing existing text paths over big structural changes.
"""


def _provider_name_to_enum(name: str) -> LlmProvider:
    if name.lower() == "openai":
        return LlmProvider.OPENAI
    return LlmProvider.OLLAMA


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


class ResumeDiffAgent:
    """Agent that orchestrates resume diff generation via nanobot tools."""

    def __init__(self, config: Config | None = None) -> None:
        self.config = config or build_nanobot_config()
        self._runtime: LLMRuntime | None = None
        self._runner: AgentRunner | None = None
        self._memory = MemoryStore(workspace=_memory_workspace())

    def _load_persisted_history(self, session_id: str) -> list[ChatMessage]:
        """Read persisted history for *session_id* as ChatMessages."""
        entries = self._memory.read_unprocessed_history(since_cursor=0)
        messages: list[ChatMessage] = []
        for entry in entries:
            if entry.get("session_key") != session_id:
                continue
            try:
                payload = json.loads(entry.get("content", ""))
            except json.JSONDecodeError:
                continue
            role = payload.get("role")
            content = payload.get("content")
            if role not in ("user", "assistant", "system") or not isinstance(
                content, str
            ):
                continue
            messages.append(
                ChatMessage(
                    id=f"m{entry.get('cursor', len(messages))}",
                    role=ChatRole(role),
                    content=content,
                )
            )
        return messages[-_MAX_PERSISTED_HISTORY_ENTRIES:]

    def _merge_conversation_history(
        self,
        request: ResumeDiffRequest,
    ) -> list[ChatMessage]:
        """Merge persisted history with the incoming conversation history.

        The frontend sends only the system message plus the current user
        message when a session id is active. Persisted history supplies the
        rest of the conversation.
        """
        session_id = request.sessionId
        incoming = list(request.conversationHistory or [])
        if not session_id:
            return incoming

        persisted = self._load_persisted_history(session_id)
        non_system = [m for m in incoming if m.role != "system"]
        # Keep the current user message from the frontend; earlier turns are
        # loaded from persistent storage.
        current = [non_system[-1]] if non_system else []
        return persisted + current

    def _persist_turn(
        self,
        session_id: str,
        instruction: str,
        result: ResumeDiffResults,
    ) -> None:
        """Append the current turn to persistent history."""
        user_entry = json.dumps(
            {"role": "user", "content": instruction},
            ensure_ascii=False,
        )
        self._memory.append_history(user_entry, session_key=session_id)

        diff_word = "diffs" if len(result.diffs) != 1 else "diff"
        note = result.note or f"Generated {len(result.diffs)} resume {diff_word}."
        assistant_entry = json.dumps(
            {"role": "assistant", "content": note},
            ensure_ascii=False,
        )
        self._memory.append_history(assistant_entry, session_key=session_id)

    def _get_runtime(self) -> LLMRuntime:
        if self._runtime is None:
            provider = make_provider(self.config)
            preset = self.config.resolve_preset()
            self._runtime = LLMRuntime.capture(
                provider,
                preset.model,
                context_window_tokens=preset.context_window_tokens,
            )
        return self._runtime

    def _get_runner(self) -> AgentRunner:
        if self._runner is None:
            self._runner = AgentRunner()
        return self._runner

    def _build_tools(self, runtime: LLMRuntime) -> ToolRegistry:
        registry = ToolRegistry()
        registry.register(ClassifyIntentTool(runtime))
        registry.register(BuildContextTool())
        registry.register(GenerateDiffTool(runtime))
        registry.register(ValidateDiffTool())
        registry.register(FinalizeDiffTool())
        return registry

    async def generate(
        self,
        request: ResumeDiffRequest,
        request_id: str,
    ) -> ResumeDiffResults:
        # Hydrate conversation history from persistent storage when the request
        # belongs to an active session.
        request.conversationHistory = self._merge_conversation_history(request)

        state = ResumeDiffState(
            request=request,
            request_id=request_id,
        )
        set_state(state)

        runtime = self._get_runtime()
        tools = self._build_tools(runtime)

        # The user message contains the instruction and a compact view of the
        # resume so the agent can start classifying intent immediately.
        resume_preview = (
            request.resumeDom or request.resumeStructure or request.resumeSummary or ""
        )
        initial_messages = [
            {"role": "system", "content": AGENT_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"""Instruction: {request.instruction}

Allowed class names: {", ".join(request.allowClassNames or [])}

Resume preview (JSON):
{resume_preview[:4000]}

Please run the workflow and finalize the diffs.""",
            },
        ]

        log_event(
            "start run_resume_diff_gen",
            {"requestId": request_id, "instruction": request.instruction},
        )

        spec = AgentRunSpec(
            initial_messages=initial_messages,
            tools=tools,
            runtime=runtime,
            max_iterations=10,
            max_tool_result_chars=32_000,
            fail_on_tool_error=False,
        )

        runner_result = await self._get_runner().run(spec)

        if state.final_result is not None:
            final = state.final_result
        else:
            # Agent finished without finalizing: fall back to parsing the last
            # raw output.
            if state.validated_diffs:
                diffs = state.validated_diffs
            elif state.raw_diff_output:
                try:
                    diffs = json.loads(extract_json(state.raw_diff_output))
                except Exception:
                    diffs = []
            else:
                diffs = []

            final = ResumeDiffResults(
                ok=True,
                diffs=diffs,
                provider=_provider_name_to_enum(get_provider_name()),
                model=get_default_model(),
                note=f"Generated {len(diffs)} resume diff{'s' if len(diffs) != 1 else ''}.",  # noqa: E501
                usage=_map_usage(
                    dict(runner_result.usage) if runner_result.usage else None
                ),
            )

        if request.sessionId:
            self._persist_turn(request.sessionId, request.instruction, final)

        log_event(
            "resume_diff_request_response",
            {"requestId": request_id, "ok": final.ok, "diffCount": len(final.diffs)},
        )
        return final

    async def close(self) -> None:
        pass
