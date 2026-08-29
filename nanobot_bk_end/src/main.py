"""FastAPI entry point for the nanobot resume-diff backend."""

from __future__ import annotations

import asyncio
import os
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .agent.resume_diff import ResumeDiffAgent
from .config import get_default_model, get_provider_name, get_server_host, get_server_port
from .logger import log_event
from .schemas import (
    BackendHealthResponse,
    LlmProvider,
    LlmStatusResponse,
    ResumeDiffRequest,
    ResumeDiffResults,
)

# Load environment variables from the project root first, then fall back to the
# backend-local .env file.
ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(ROOT_DIR / ".env")
load_dotenv(ROOT_DIR / "nanobot_bk_end" / ".env")


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.agent = ResumeDiffAgent()
    yield
    await app.state.agent.close()


app = FastAPI(title="Resume Nanobot Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _provider_enum() -> LlmProvider:
    return LlmProvider.OPENAI if get_provider_name() == "openai" else LlmProvider.OLLAMA


@app.get("/health")
async def health() -> BackendHealthResponse:
    return BackendHealthResponse(ok=True)


@app.get("/llm/status")
async def llm_status() -> LlmStatusResponse:
    provider = get_provider_name()
    model = get_default_model()

    if provider == "openai":
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            return LlmStatusResponse(
                ok=False,
                provider=provider,
                model=model,
                reason="missing_config",
                message="OpenAI API key is not configured.",
            )
        return LlmStatusResponse(
            ok=True,
            provider=provider,
            model=model,
            message=f"{model} is configured via OpenAI.",
        )

    # Ollama
    chat_url = os.environ.get("OLLAMA_CHAT_URL", "http://localhost:11434/api/chat")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(
                chat_url,
                json={
                    "model": model,
                    "stream": False,
                    "messages": [{"role": "user", "content": "ping"}],
                    "options": {"temperature": 0},
                },
            )
        if response.status_code == 200:
            return LlmStatusResponse(
                ok=True,
                provider=provider,
                model=model,
                message=f"{model} is reachable via Ollama.",
            )
        if response.status_code == 404:
            return LlmStatusResponse(
                ok=False,
                provider=provider,
                model=model,
                reason="model_missing",
                message=f"Ollama returned 404 for model {model}.",
            )
        return LlmStatusResponse(
            ok=False,
            provider=provider,
            model=model,
            reason="offline",
            message=f"Ollama returned {response.status_code}.",
        )
    except Exception as exc:
        return LlmStatusResponse(
            ok=False,
            provider=provider,
            model=model,
            reason="offline",
            message=f"Ollama status check failed: {exc}",
        )


@app.post("/llm/warmup")
async def llm_warmup() -> dict[str, bool]:
    provider = get_provider_name()
    model = get_default_model()

    if provider == "openai":
        return {"ok": True}

    chat_url = os.environ.get("OLLAMA_CHAT_URL", "http://localhost:11434/api/chat")
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                chat_url,
                json={
                    "model": model,
                    "stream": False,
                    "messages": [{"role": "user", "content": "warmup"}],
                    "options": {"temperature": 0},
                },
            )
        return {"ok": response.status_code == 200}
    except Exception:
        return {"ok": False}


@app.post("/llm/resume-diff")
async def resume_diff(request: Request, body: ResumeDiffRequest) -> ResumeDiffResults:
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    log_event(
        "start run_resume_diff_gen",
        {"requestId": request_id, "instruction": body.instruction},
    )

    agent: ResumeDiffAgent = request.app.state.agent
    try:
        result = await agent.generate(body, request_id)
    except Exception as exc:
        message = str(exc)
        log_event(
            "run_resume_diff_gen err",
            {"requestId": request_id, "error": message},
        )
        return ResumeDiffResults(
            ok=False,
            diffs=[],
            provider=_provider_enum(),
            model=get_default_model(),
            note=message,
        )

    log_event(
        "resume_diff_request_response",
        {"requestId": request_id, "ok": result.ok, "diffCount": len(result.diffs)},
    )
    return result


@app.exception_handler(Exception)
async def generic_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
    log_event("unhandled_exception", {"error": str(exc)})
    return JSONResponse(
        status_code=500,
        content={"ok": False, "note": str(exc), "diffs": []},
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.main:app",
        host=get_server_host(),
        port=get_server_port(),
        reload=True,
    )
