# resume-agent backend

Hono backend for resume-agent. It exposes the `/llm/*` API used by the Vite
client and selects either Ollama or OpenAI-compatible chat completions.

From the repository root:

```bash
pnpm install
pnpm run server:dev
```

The server defaults to:

```text
http://localhost:3003
```

OpenAI configuration:

```bash
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
OPENAI_BASE_URL=https://api.openai.com/v1
```

Ollama configuration:

```bash
OLLAMA_MODEL=qwen2.5-coder:7b
OLLAMA_CHAT_URL=http://localhost:11434/api/chat
```

To use Ollama, leave `OPENAI_API_KEY` unset and do not set
`LLM_PROVIDER=openai`.

See the root `README.md` for the full local development flow.
