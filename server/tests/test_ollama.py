import httpx
import pytest

from server.app import ollama
from server.app.ollama import get_ollama_tags_url


def test_derives_ollama_tags_url_from_chat_url():
    assert get_ollama_tags_url("http://localhost:11434/api/chat") == "http://localhost:11434/api/tags"


def test_drops_query_strings_and_hashes_from_tags_url():
    assert get_ollama_tags_url("http://localhost:11434/api/chat?x=1#hash") == "http://localhost:11434/api/tags"


@pytest.mark.anyio
async def test_health_reports_offline_when_ollama_request_fails(monkeypatch):
    class FailingClient:
        def __init__(self, timeout):
            self.timeout = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, traceback):
            return None

        async def get(self, url):
            raise httpx.ConnectError("offline")

    monkeypatch.setattr(ollama.httpx, "AsyncClient", FailingClient)

    result = await ollama.check_ollama_health("http://localhost:11434/api/chat", "qwen2.5-coder:7b")

    assert result == {"ok": False, "reason": "offline", "message": "Ollama is not reachable."}


@pytest.mark.anyio
async def test_health_reports_missing_model(monkeypatch):
    class MissingModelClient:
        def __init__(self, timeout):
            self.timeout = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, traceback):
            return None

        async def get(self, url):
            return httpx.Response(200, json={"models": [{"name": "llama3.2"}]})

    monkeypatch.setattr(ollama.httpx, "AsyncClient", MissingModelClient)

    result = await ollama.check_ollama_health("http://localhost:11434/api/chat", "qwen2.5-coder:7b")

    assert result == {
        "ok": False,
        "reason": "model_missing",
        "message": "Model qwen2.5-coder:7b was not found.",
    }


@pytest.mark.anyio
async def test_health_reports_available_model(monkeypatch):
    class AvailableModelClient:
        def __init__(self, timeout):
            self.timeout = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, traceback):
            return None

        async def get(self, url):
            return httpx.Response(200, json={"models": [{"model": "qwen2.5-coder:7b"}]})

    monkeypatch.setattr(ollama.httpx, "AsyncClient", AvailableModelClient)

    result = await ollama.check_ollama_health("http://localhost:11434/api/chat", "qwen2.5-coder:7b")

    assert result == {"ok": True}
