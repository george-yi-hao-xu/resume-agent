# resume-agent

Local-first resume editing MVP. The app runs a React frontend and a local
FastAPI backend. The backend sends editing instructions to your local Ollama
server, validates the returned JSON patches, and the frontend applies those
patches to the resume preview.

## Prerequisites

- Node.js 22+
- pnpm 10+
- Python 3.11+
- Ollama running locally

Install Ollama from <https://ollama.com>, then pull the default model:

```bash
ollama pull qwen2.5-coder:7b
```

## Run Locally

Start Ollama:

```bash
ollama run qwen2.5-coder:7b
```

In another terminal, clone and install the frontend:

```bash
git clone https://github.com/george-yi-hao-xu/resume-agent.git
cd resume-agent
pnpm install
```

Install the Python backend dependencies:

```bash
python -m venv .venv
.venv/bin/pip install -r server/requirements.txt
```

Start the local Python API:

```bash
.venv/bin/uvicorn server.app.main:app --reload --host 0.0.0.0 --port 8000
```

In another terminal, start the frontend:

```bash
pnpm run dev
```

Open the local URL printed by Vite, usually:

```text
http://localhost:5173
```

The frontend defaults to this local API endpoint:

```text
http://localhost:8000
```

The Python backend defaults to this Ollama endpoint:

```text
http://localhost:11434/api/chat
```

Override it with:

```bash
RESUME_AGENT_OLLAMA_CHAT_URL=http://localhost:11434/api/chat .venv/bin/uvicorn server.app.main:app --reload
```

You can change the model, API URL, and temperature from the settings button
inside the app.

## Troubleshooting

Check that Ollama is running:

```bash
curl http://localhost:11434/api/tags
```

Check that the Python API is running:

```bash
curl "http://localhost:8000/api/health?model=qwen2.5-coder:7b"
```

If `ollama serve` says the address is already in use, Ollama is already running.

If the app says the model is missing, pull it again:

```bash
ollama pull qwen2.5-coder:7b
```

GitHub Pages is useful for viewing the UI, but browser calls from
`https://george-yi-hao-xu.github.io` to local Ollama may need extra CORS setup.
For the MVP, use `pnpm run dev` locally.

## Commands

```bash
pnpm run dev       # start local Vite dev server
pnpm test --runInBand
pnpm run build
.venv/bin/pytest server
```
