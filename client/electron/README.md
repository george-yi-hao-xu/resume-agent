# Electron Shell

The Electron app wraps the existing React frontend and FastAPI backend.

## Development

From `client/`:

```bash
pnpm run electron:dev
```

This starts Vite, launches Electron, starts the FastAPI backend from
`server/.venv`, and injects this API URL into the frontend:

```text
http://127.0.0.1:8765
```

Ollama still needs to be running locally:

```bash
ollama run qwen2.5-coder:7b
```

## Packaging Plan

The packaged app should load the built React files from `client/dist` and start
a bundled backend executable from Electron resources.

Build the backend executable from `server/`:

```bash
source .venv/bin/activate
pip install pyinstaller
pyinstaller --name resume-agent-api --onefile --paths . --collect-submodules app run_api.py
```

Install the Electron packaging tool from `client/`:

```bash
pnpm add -D electron-builder
```

Create an unpacked desktop build:

```bash
pnpm run electron:pack
```

Create a distributable build:

```bash
pnpm run electron:dist
```

On Windows, run the backend PyInstaller step and Electron packaging step on
Windows to produce a Windows `.exe`.
