# Resume Agent API

FastAPI backend for the resume editor.

## Start the Server

From this `server/` directory:

```bash
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

`app.main:app` means:

- `app.main`: the Python module at `server/app/main.py`
- `app`: the FastAPI instance named `app` inside that file

Open the root endpoint:

```text
http://localhost:8000
```

Open the FastAPI docs:

```text
http://localhost:8000/docs
```

## WSL Notes

If the server runs inside WSL and the browser runs on Windows, `localhost:8000`
may not always work from Windows even when `curl http://127.0.0.1:8000` works
inside WSL.

Start uvicorn with `--host 0.0.0.0`, not `--host 127.0.0.1`:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Then find the WSL IP:

```bash
hostname -I
```

If it prints something like:

```text
172.28.123.45
```

open this from Windows:

```text
http://172.28.123.45:8000
```

Use `http://`, not `https://`.

Vite may still work with `localhost` while FastAPI does not. That does not
necessarily mean the FastAPI app is broken; it is usually a WSL localhost
forwarding or bind-address issue.

## Health Check

The backend talks to local Ollama. Check the API and model with:

```bash
curl "http://localhost:8000/api/health?model=qwen2.5-coder:7b"
```

If calling from Windows and `localhost:8000` does not work, use the WSL IP:

```bash
curl "http://<WSL_IP>:8000/api/health?model=qwen2.5-coder:7b"
```
