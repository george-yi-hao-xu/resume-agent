const { app, BrowserWindow, dialog } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const FRONTEND_URL = process.env.ELECTRON_FRONTEND_URL ?? "http://127.0.0.1:5173";
const BACKEND_PORT = process.env.ELECTRON_BACKEND_PORT ?? "8765";
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;

let backendProcess;

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1040,
    minHeight: 720,
    title: "Resume Agent",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (app.isPackaged) {
    window.loadFile(path.join(app.getAppPath(), "dist", "index.html"), {
      query: { apiUrl: BACKEND_URL }
    });
    return;
  }

  const devUrl = new URL(FRONTEND_URL);
  devUrl.searchParams.set("apiUrl", BACKEND_URL);
  window.loadURL(devUrl.toString());
}

function startBackend() {
  const backend = getBackendCommand();
  if (!backend) {
    return;
  }

  backendProcess = spawn(backend.command, backend.args, {
    cwd: backend.cwd,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });

  backendProcess.stdout.on("data", (data) => {
    process.stdout.write(`[fastapi] ${data}`);
  });

  backendProcess.stderr.on("data", (data) => {
    process.stderr.write(`[fastapi] ${data}`);
  });

  backendProcess.on("exit", (code, signal) => {
    backendProcess = undefined;
    if (code !== 0 && signal !== "SIGTERM") {
      console.error(`FastAPI backend exited with code ${code ?? "unknown"}.`);
    }
  });
}

function getBackendCommand() {
  if (app.isPackaged) {
    return getPackagedBackendCommand();
  }

  return getDevBackendCommand();
}

function getDevBackendCommand() {
  const serverDir = path.resolve(__dirname, "..", "..", "server");
  const uvicornPath =
    process.platform === "win32"
      ? path.join(serverDir, ".venv", "Scripts", "uvicorn.exe")
      : path.join(serverDir, ".venv", "bin", "uvicorn");

  if (!fs.existsSync(uvicornPath)) {
    dialog.showErrorBox(
      "FastAPI backend not found",
      `Could not find uvicorn at:\n${uvicornPath}\n\nCreate the server virtual environment and install server/requirements.txt.`
    );
    return undefined;
  }

  return {
    command: uvicornPath,
    args: ["app.main:app", "--host", "127.0.0.1", "--port", BACKEND_PORT],
    cwd: serverDir
  };
}

function getPackagedBackendCommand() {
  const backendName = process.platform === "win32" ? "resume-agent-api.exe" : "resume-agent-api";
  const backendPath = path.join(process.resourcesPath, "backend", backendName);

  if (!fs.existsSync(backendPath)) {
    dialog.showErrorBox(
      "Packaged backend not found",
      `Could not find the bundled FastAPI backend at:\n${backendPath}`
    );
    return undefined;
  }

  return {
    command: backendPath,
    args: ["--host", "127.0.0.1", "--port", BACKEND_PORT],
    cwd: path.dirname(backendPath)
  };
}

function stopBackend() {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
  }
}

app.whenReady().then(() => {
  startBackend();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", stopBackend);
