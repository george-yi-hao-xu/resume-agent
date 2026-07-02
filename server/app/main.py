from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .models import HealthResult, PatchProviderResult, PatchRequest
from .ollama import check_ollama_health, get_patches_from_instruction

app = FastAPI(title="Resume Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/")
async def root() -> dict[str, str]:
    return {
        "name": "Resume Agent API",
        "health": "/api/health?model=qwen2.5-coder:7b",
    }


@app.post("/api/patches", response_model=PatchProviderResult)
async def create_patches(request: PatchRequest) -> PatchProviderResult:
    try:
        return await get_patches_from_instruction(
            request.instruction,
            request.model,
            settings.ollama_chat_url,
            request.temperature,
        )
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error


@app.get("/api/health", response_model=HealthResult)
async def health(model: str = Query(..., min_length=1)) -> HealthResult:
    return await check_ollama_health(settings.ollama_chat_url, model)
