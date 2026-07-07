# resume-agent

Local-first resume editing MVP. The app runs in your browser, sends editing
instructions to your local Ollama server, and applies the returned JSON patches
to the resume preview.

## Prerequisites

- Node.js 22+
- pnpm 10+
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

In another terminal, clone and run the app:

```bash
git clone https://github.com/george-yi-hao-xu/resume-agent.git
cd resume-agent
pnpm install
pnpm run dev
```

Open the local URL printed by Vite, usually:

```text
http://localhost:5173
```

The app defaults to this Ollama endpoint:

```text
http://localhost:11434/api/chat
```

You can change the model, backend URL, and temperature from the settings button
inside the app.

## Troubleshooting

Check that Ollama is running:
c

```bash
curl http://localhost:11434/api/tags
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
```
