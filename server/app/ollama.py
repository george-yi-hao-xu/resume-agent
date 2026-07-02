from urllib.parse import urlsplit, urlunsplit

import httpx

from .models import HealthResult, PatchProviderResult, PreviewContext
from .patches import parse_and_validate_patches
from .prompt import build_system_prompt


def get_ollama_tags_url(chat_url: str) -> str:
    parts = urlsplit(chat_url)
    return urlunsplit((parts.scheme, parts.netloc, "/api/tags", "", ""))


async def get_patches_from_instruction(
    instruction: str,
    model: str,
    ollama_chat_url: str,
    temperature: float,
    preview_context: PreviewContext | None = None,
) -> PatchProviderResult:
    patches = await call_ollama(instruction, model, ollama_chat_url, temperature, preview_context)
    return PatchProviderResult(patches=patches, provider="ollama", model=model)


async def check_ollama_health(ollama_chat_url: str, model: str, timeout_seconds: float = 3) -> HealthResult:
    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.get(get_ollama_tags_url(ollama_chat_url))
    except httpx.HTTPError:
        return {"ok": False, "reason": "offline", "message": "Ollama is not reachable."}

    if response.status_code >= 400:
        return {"ok": False, "reason": "offline", "message": f"Ollama returned {response.status_code}."}

    data = response.json()
    models = data.get("models") if isinstance(data, dict) else []
    has_model = any(item.get("name") == model or item.get("model") == model for item in models if isinstance(item, dict))
    if not has_model:
        return {"ok": False, "reason": "model_missing", "message": f"Model {model} was not found."}

    return {"ok": True}


async def call_ollama(
    instruction: str,
    model: str,
    ollama_chat_url: str,
    temperature: float,
    preview_context: PreviewContext | None = None,
) -> list:
    payload = {
        "model": model,
        "stream": False,
        "messages": [
            {"role": "system", "content": build_system_prompt(preview_context)},
            {"role": "user", "content": instruction},
        ],
        "options": {"temperature": temperature},
    }

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(ollama_chat_url, json=payload)
    except httpx.HTTPError as error:
        raise RuntimeError("Ollama is not reachable.") from error

    if response.status_code >= 400:
        raise RuntimeError(f"Ollama returned {response.status_code}.")

    data = response.json()
    content = data.get("message", {}).get("content") if isinstance(data, dict) else None
    if not content:
        raise RuntimeError("Ollama returned an empty response.")

    return parse_and_validate_patches(content)
