"""Load environment variables and build a nanobot config object."""

from __future__ import annotations

import os
from pathlib import Path

from nanobot.config.loader import load_config, resolve_config_env_vars
from nanobot.config.schema import AgentsConfig, AgentDefaults, Config, ProvidersConfig


DEFAULT_OLLAMA_MODEL = "glm4:latest"
DEFAULT_OLLAMA_CHAT_URL = "http://localhost:11434/api/chat"
DEFAULT_OPENAI_MODEL = "gpt-4o"


def get_env(key: str, default: str | None = None) -> str | None:
    return os.environ.get(key, default)


def get_env_int(key: str, default: int) -> int:
    try:
        return int(os.environ.get(key, ""))
    except ValueError:
        return default


def get_env_float(key: str, default: float) -> float:
    try:
        return float(os.environ.get(key, ""))
    except ValueError:
        return default


def build_nanobot_config() -> Config:
    """Build a nanobot Config from environment variables.

    Reuses the same variable names as the legacy Hono backend so existing
    .env files keep working.
    """
    provider = (get_env("LLM_PROVIDER", "ollama") or "ollama").lower()
    temperature = get_env_float("LLM_TEMPERATURE", 0.1)
    max_tokens = get_env_int("LLM_DIFF_NUM_PREDICT", 2048)

    providers = ProvidersConfig(
        openai={
            "api_key": get_env("OPENAI_API_KEY", ""),
            "api_base": get_env("OPENAI_BASE_URL", "https://api.openai.com/v1"),
        },
        ollama={
            "api_base": get_env("OLLAMA_CHAT_URL", DEFAULT_OLLAMA_CHAT_URL),
        },
    )

    if provider == "openai":
        model = get_env("OPENAI_MODEL", DEFAULT_OPENAI_MODEL)
    else:
        model = get_env("OLLAMA_MODEL", DEFAULT_OLLAMA_MODEL)
        provider = "ollama"

    defaults = AgentDefaults(
        model=model,
        provider=provider,
        max_tokens=max_tokens,
        temperature=temperature,
        # Disable skills/tools that are not relevant for the resume-diff API.
        disabled_skills=["*"],
    )

    config = Config(
        agents=AgentsConfig(defaults=defaults),
        providers=providers,
    )

    # Allow a static config file to override env-derived values.
    config_path_env = get_env("NANOBOT_CONFIG_PATH")
    if config_path_env:
        config_path = Path(config_path_env).expanduser().resolve()
        if config_path.exists():
            file_config = resolve_config_env_vars(load_config(config_path))
            # Merge file config over env config.
            config = Config.model_validate({
                **config.model_dump(mode="json", by_alias=True),
                **file_config.model_dump(mode="json", by_alias=True),
            })

    return config


def get_server_port() -> int:
    return get_env_int("SERVER_PORT", 3003)


def get_server_host() -> str:
    return get_env("SERVER_HOST", "0.0.0.0") or "0.0.0.0"


def get_default_model() -> str:
    provider = (get_env("LLM_PROVIDER", "ollama") or "ollama").lower()
    if provider == "openai":
        return get_env("OPENAI_MODEL", DEFAULT_OPENAI_MODEL)
    return get_env("OLLAMA_MODEL", DEFAULT_OLLAMA_MODEL)


def get_provider_name() -> str:
    return (get_env("LLM_PROVIDER", "ollama") or "ollama").lower()
