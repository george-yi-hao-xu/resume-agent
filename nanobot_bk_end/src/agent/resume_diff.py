"""Resume diff generation using nanobot's AgentRunner + custom tools."""

from __future__ import annotations

import json
import os
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any

from nanobot.agent.memory import MemoryStore
from nanobot.agent.runner import AgentRunner, AgentRunSpec
from nanobot.agent.tools.registry import ToolRegistry
from nanobot.config.schema import Config
from nanobot.providers.base import LLMProvider as NanobotLLMProvider
from nanobot.providers.base import LLMResponse
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
from .state import ResumeDiffState, get_state, set_state
from .tools import (
    BuildContextTool,
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
1. Call `build_context` to get relevant resume nodes and a path index.
2. Call `generate_diff` to ask the LLM to produce JSON Patch diffs.
3. Call `validate_diff` to parse and validate the raw diffs.
4. If validation fails, inspect the error and retry `generate_diff` up to 2 times.
5. Once validation succeeds, call `finalize_diff` with the validated diffs and stop.

Rules:
- Do not output final JSON in text. Always use `finalize_diff`.
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


def _tool_call_names(response: LLMResponse) -> list[str]:
    return [
        name
        for name in (getattr(call, "name", None) for call in response.tool_calls)
        if isinstance(name, str) and name
    ]


class _DebugLoggingProvider(NanobotLLMProvider):
    """Log raw provider responses while delegating behavior unchanged."""

    def __init__(self, provider: NanobotLLMProvider) -> None:
        self._provider = provider
        self.api_key = getattr(provider, "api_key", None)
        self.api_base = getattr(provider, "api_base", None)
        self._call_count = 0

    def __getattr__(self, name: str) -> Any:
        return getattr(self._provider, name)

    @property
    def generation(self) -> Any:
        return self._provider.generation

    @generation.setter
    def generation(self, value: Any) -> None:
        self._provider.generation = value

    @property
    def supports_progress_deltas(self) -> bool:
        return bool(getattr(self._provider, "supports_progress_deltas", False))

    def get_default_model(self) -> str:
        return self._provider.get_default_model()

    def _next_call_index(self) -> int:
        self._call_count += 1
        return self._call_count

    def _log_response(
        self,
        *,
        method: str,
        call_index: int,
        response: LLMResponse,
        model: str | None,
    ) -> None:
        log_event(
            "llm_provider_response_raw",
            {
                "requestId": self._current_request_id(),
                "provider": get_provider_name(),
                "model": model or self.get_default_model(),
                "method": method,
                "callIndex": call_index,
                "finishReason": response.finish_reason,
                "rawContent": response.content or "",
                "toolCalls": _tool_call_names(response),
                "usage": response.usage,
            },
        )

    def _current_request_id(self) -> str | None:
        try:
            return get_state().request_id
        except RuntimeError:
            return None

    async def chat(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
        model: str | None = None,
        max_tokens: int = 4096,
        temperature: float = 0.7,
        reasoning_effort: str | None = None,
        tool_choice: str | dict[str, Any] | None = None,
    ) -> LLMResponse:
        call_index = self._next_call_index()
        response = await self._provider.chat(
            messages=messages,
            tools=tools,
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            reasoning_effort=reasoning_effort,
            tool_choice=tool_choice,
        )
        self._log_response(
            method="chat",
            call_index=call_index,
            response=response,
            model=model,
        )
        return response

    async def chat_with_retry(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
        model: str | None = None,
        max_tokens: object = NanobotLLMProvider._SENTINEL,
        temperature: object = NanobotLLMProvider._SENTINEL,
        reasoning_effort: object = NanobotLLMProvider._SENTINEL,
        tool_choice: str | dict[str, Any] | None = None,
        retry_mode: str = "standard",
        on_retry_wait: Callable[[str], Awaitable[None]] | None = None,
    ) -> LLMResponse:
        call_index = self._next_call_index()
        response = await self._provider.chat_with_retry(
            messages=messages,
            tools=tools,
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            reasoning_effort=reasoning_effort,
            tool_choice=tool_choice,
            retry_mode=retry_mode,
            on_retry_wait=on_retry_wait,
        )
        self._log_response(
            method="chat_with_retry",
            call_index=call_index,
            response=response,
            model=model,
        )
        return response

    async def chat_stream_with_retry(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
        model: str | None = None,
        max_tokens: object = NanobotLLMProvider._SENTINEL,
        temperature: object = NanobotLLMProvider._SENTINEL,
        reasoning_effort: object = NanobotLLMProvider._SENTINEL,
        tool_choice: str | dict[str, Any] | None = None,
        on_content_delta: Callable[[str], Awaitable[None]] | None = None,
        on_thinking_delta: Callable[[str], Awaitable[None]] | None = None,
        on_tool_call_delta: Callable[[dict[str, Any]], Awaitable[None]] | None = None,
        on_stream_recover: Callable[[], Awaitable[None]] | None = None,
        retry_mode: str = "standard",
        on_retry_wait: Callable[[str], Awaitable[None]] | None = None,
    ) -> LLMResponse:
        call_index = self._next_call_index()
        response = await self._provider.chat_stream_with_retry(
            messages=messages,
            tools=tools,
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            reasoning_effort=reasoning_effort,
            tool_choice=tool_choice,
            on_content_delta=on_content_delta,
            on_thinking_delta=on_thinking_delta,
            on_tool_call_delta=on_tool_call_delta,
            on_stream_recover=on_stream_recover,
            retry_mode=retry_mode,
            on_retry_wait=on_retry_wait,
        )
        self._log_response(
            method="chat_stream_with_retry",
            call_index=call_index,
            response=response,
            model=model,
        )
        return response


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
            provider = _DebugLoggingProvider(make_provider(self.config))
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
        # resume so the agent can build context before generating diffs.
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
