from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ollama_chat_url: str = Field(default="http://localhost:11434/api/chat")
    cors_origins: list[str] = Field(default=["http://localhost:5173", "http://127.0.0.1:5173", "null"])

    model_config = SettingsConfigDict(env_prefix="RESUME_AGENT_", env_file=".env")


settings = Settings()
