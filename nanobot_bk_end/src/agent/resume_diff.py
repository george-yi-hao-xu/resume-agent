"""Resume diff generation using nanobot's AgentRunner + custom tools."""

from __future__ import annotations

import json
from typing import Any

from nanobot.agent.runner import AgentRunner, AgentRunSpec
from nanobot.agent.tools.registry import ToolRegistry
from nanobot.config.schema import Config
from nanobot.providers.factory import make_provider
from nanobot.utils.llm_runtime import LLMRuntime

from ..config import build_nanobot_config, get_default_model, get_provider_name
from ..logger import log_event
from ..schemas import LlmProvider, LlmUsage, ResumeDiffRequest, ResumeDiffResults
from ..utils import extract_json
from .state import ResumeDiffState, set_state
from .tools import (
    BuildContextTool,
    ClassifyIntentTool,
    FinalizeDiffTool,
    GenerateDiffTool,
    ValidateDiffTool,
)


AGENT_SYSTEM_PROMPT = """\
You are a resume editing assistant. Your goal is to produce a valid JSON Patch diff for the user's resume.

You must follow this workflow:
1. Call `classify_intent` to understand the user's request.
2. Call `build_context` to get relevant resume nodes and a path index.
3. Call `generate_diff` to ask the LLM to produce JSON Patch diffs.
4. Call `validate_diff` to parse and validate the raw diffs.
5. If validation fails, inspect the error and call `generate_diff` again with corrections. Repeat up to 2 times.
6. Once validation succeeds, call `finalize_diff` with the validated diffs and stop.

Rules:
- Do not output the final JSON directly in your text response. Always use `finalize_diff`.
- If the intent is "ambiguous", still do your best to generate minimal, safe diffs.
- Keep diffs small and precise. Prefer replacing existing text paths over large structural changes.
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
        state = ResumeDiffState(
            request=request,
            request_id=request_id,
        )
        set_state(state)

        runtime = self._get_runtime()
        tools = self._build_tools(runtime)

        # The user message contains the instruction and a compact view of the
        # resume so the agent can start classifying intent immediately.
        resume_preview = request.resumeDom or request.resumeStructure or request.resumeSummary or ""
        initial_messages = [
            {"role": "system", "content": AGENT_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"""Instruction: {request.instruction}

Allowed class names: {', '.join(request.allowClassNames or [])}

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

        result = await self._get_runner().run(spec)

        if state.final_result is not None:
            log_event(
                "resume_diff_request_response",
                {
                    "requestId": request_id,
                    "ok": state.final_result.ok,
                    "diffCount": len(state.final_result.diffs),
                },
            )
            return state.final_result

        # Agent finished without finalizing: fall back to parsing the last raw output.
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
            note=f"Generated {len(diffs)} resume diff{'s' if len(diffs) != 1 else ''}.",
            usage=_map_usage(dict(result.usage) if result.usage else None),
        )
        log_event(
            "resume_diff_request_response",
            {"requestId": request_id, "ok": final.ok, "diffCount": len(final.diffs)},
        )
        return final

    async def close(self) -> None:
        pass
