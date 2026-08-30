"""Pydantic models aligned with packages/schema/src/index.ts."""

from __future__ import annotations

from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field


class LlmProvider(str, Enum):
    OLLAMA = "ollama"
    OPENAI = "openai"


class ChatRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class ChatMessage(BaseModel):
    id: str
    role: ChatRole
    content: str
    diffs: list[dict[str, Any]] | None = None
    provider: LlmProvider | None = None
    usage: "LlmUsage | None" = None


class ResumeDiffRequest(BaseModel):
    instruction: str
    allowClassNames: list[str] | None = None
    conversationHistory: list[ChatMessage] | None = None
    resumeSummary: str | None = None
    resumeDom: str | None = None
    resumeStructure: str | None = None
    sessionId: str | None = None


class LlmUsage(BaseModel):
    promptEvalCount: int | None = None
    evalCount: int | None = None
    totalDuration: int | None = None
    loadDuration: int | None = None
    promptEvalDuration: int | None = None
    evalDuration: int | None = None


class ResumeDiffOp(BaseModel):
    op: Literal["add", "remove", "replace", "move", "copy", "test"]
    path: str
    value: Any | None = None
    from_: str | None = Field(default=None, alias="from")

    model_config = {"populate_by_name": True}


class ResumeDiffResults(BaseModel):
    ok: bool
    diffs: list[ResumeDiffOp]
    provider: LlmProvider
    model: str | None = None
    note: str | None = None
    usage: LlmUsage | None = None


class BackendHealthResponse(BaseModel):
    ok: bool


class LlmStatusResponse(BaseModel):
    ok: bool
    provider: str
    model: str
    message: str | None = None
    reason: Literal["offline", "model_missing", "missing_config"] | None = None
    availableModels: list[str] | None = None
