# nanobot 后端（Python）

使用 [HKUDS/nanobot](https://github.com/HKUDS/nanobot) 实现的简历编辑后端，暴露与旧 Hono 后端相同的 `/api/*` 接口，前端无需改动。

## 环境准备

```bash
# 1. 创建虚拟环境
python3 -m venv .venv

# 2. 激活
source .venv/bin/activate

# 3. 安装依赖
pip install -r requirements.txt
```

## 启动

```bash
source .venv/bin/activate
uvicorn src.main:app --reload --port 3003
```

或从项目根目录使用 pnpm 脚本（需先激活虚拟环境）：

```bash
source nanobot_bk_end/.venv/bin/activate
pnpm nanobot:dev
```

## 接口

- `GET /health`
- `GET /llm/status`
- `POST /llm/warmup`
- `POST /llm/resume-diff`

前端 Vite dev server 会把 `/api/*` 代理到本服务，因此浏览器里访问的是 `/api/health`、`/api/llm/status` 等。

## 配置

复用项目根目录 `.env` 中的变量：

- `SERVER_HOST` / `SERVER_PORT`
- `LLM_PROVIDER` (`ollama` 或 `openai`)
- `OLLAMA_CHAT_URL` / `OLLAMA_MODEL`
- `OPENAI_BASE_URL` / `OPENAI_MODEL` / `OPENAI_API_KEY`
- `LLM_TEMPERATURE`

## 开发

```bash
# 类型检查
pyright

# 格式化 / lint
ruff check src
ruff format src
```
