"""Per-request state shared between the agent and its tools."""

from __future__ import annotations

from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Any

from ..schemas import ResumeDiffRequest, ResumeDiffResults


@dataclass
class ResumeDiffState:
    """Mutable state for one resume-diff request."""

    request: ResumeDiffRequest
    request_id: str
    resume_context: Any = None
    path_index: str = ""
    conversation_history_text: str = ""
    raw_diff_output: str = ""
    validated_diffs: list[dict[str, Any]] = field(default_factory=list)
    validation_error: str | None = None
    final_result: ResumeDiffResults | None = None
    usage: dict[str, Any] = field(default_factory=dict)


resume_diff_state: ContextVar[ResumeDiffState | None] = ContextVar(
    "resume_diff_state", default=None
)


def get_state() -> ResumeDiffState:
    state = resume_diff_state.get()
    if state is None:
        raise RuntimeError("Resume diff state is not set in the current context.")
    return state


def set_state(state: ResumeDiffState) -> None:
    resume_diff_state.set(state)
