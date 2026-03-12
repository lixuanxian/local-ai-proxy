# Local AI Proxy

A lightweight Node.js proxy that exposes a **unified API** (compatible with both **OpenAI** and **Anthropic** formats) for multiple local AI clients. Comes with a **Web dashboard** for managing providers, viewing logs, configuring apps, and Docker sandboxing.

## Features

- **Dual API compatibility** — OpenAI (`/v1/chat/completions`) and Anthropic (`/v1/messages`) formats
- **Multiple providers** — CLI-based (Claude, Gemini, Copilot) and API-based (Ollama, OpenAI-compat, Anthropic-compat, Gemini API)
- **Smart routing** — auto-detect provider from model name, or set explicitly
- **Streaming** — SSE streaming for both API formats
- **Web UI** — Dashboard, provider management, request logs, app cards, Docker config
- **SQLite persistence** — provider configs, settings, logs, app definitions
- **CORS management** — per-app allowed origins
- **Docker sandbox** — run AI tasks in isolated containers

## Quick Start

```bash
npm install
node server.js
```

Open **http://localhost:3199** for the Web dashboard.

## Supported Providers

| Provider | Type | How it works |
|----------|------|-------------|
| Claude CLI | `cli` | Spawns `claude -p` process |
| Gemini CLI | `cli` | Spawns `gemini -p` process |
| GitHub Copilot | `cli` | Spawns `gh copilot` process |
| Ollama | `ollama` | HTTP proxy to local Ollama API |
| OpenAI Compatible | `openai-api` | Any OpenAI-compatible API (LM Studio, vLLM, etc.) |
| Anthropic Compatible | `anthropic-api` | Any Anthropic-compatible API |
| Gemini API | `gemini-api` | Google AI Studio REST API |

New providers can be added via the Web UI — just configure type, base URL, and API key.

## API Endpoints

### Proxy API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/chat/completions` | Chat (OpenAI format) |
| POST | `/v1/messages` | Chat (Anthropic format) |
| GET | `/v1/models` | List providers as models |
| GET | `/v1/providers` | List providers |

### Management API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/info` | System info |
| GET | `/api/health` | Health check |
| GET/PUT | `/api/settings/:key` | Global settings |
| CRUD | `/api/providers` | Provider configuration |
| POST | `/api/providers/:id/test` | Test provider connectivity |
| PUT | `/api/providers/:id/default` | Set default provider |
| GET/DELETE | `/api/logs` | Request logs |
| GET | `/api/logs/stats` | Log statistics |
| CRUD | `/api/apps` | App/website management |
| CRUD | `/api/docker/configs` | Docker sandbox configs |
| GET | `/api/docker/status` | Docker status |

## Examples

```bash
# OpenAI format
curl http://localhost:3199/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"provider":"claude","messages":[{"role":"user","content":"hello"}]}'

# Anthropic format
curl http://localhost:3199/v1/messages \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-sonnet-4-20250514","messages":[{"role":"user","content":"hello"}]}'

# Auto-detect provider from model name
curl http://localhost:3199/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"hello"}]}'

# Streaming
curl http://localhost:3199/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"llama3","stream":true,"messages":[{"role":"user","content":"hello"}]}'
```

## Configuration

Environment variables (used for initial seeding, then managed via Web UI):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3199` | Server port |
| `DEFAULT_PROVIDER` | `claude` | Fallback provider |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama API address |
| `OPENAI_BASE_URL` | `http://localhost:1234` | OpenAI-compatible API address |
| `OPENAI_API_KEY` | _(empty)_ | API key for OpenAI-compatible backend |

## Web UI Pages

- **Dashboard** — App cards grid + request statistics
- **Providers** — Add/edit/delete providers, test connectivity, set default
- **Logs** — Toggle logging, filter/search, view request details
- **Apps** — Manage website cards (name, URL, icon, CORS origin)
- **Docker** — Docker sandbox configuration and status

## Project Structure

```
local-ai-proxy/
├── server.js                  # Express entry point
├── lib/
│   ├── db.js                  # SQLite initialization & migrations
│   ├── config.js              # CRUD for providers, apps, settings
│   ├── logger.js              # Request logging middleware
│   ├── provider-registry.js   # Provider loading & resolution
│   ├── utils.js               # Shared utilities
│   └── docker.js              # Docker container management
├── providers/
│   ├── base-cli.js            # CLI provider base class
│   ├── base-api.js            # HTTP API provider base class
│   ├── claude-cli.js          # Claude CLI adapter
│   ├── gemini-cli.js          # Gemini CLI adapter
│   ├── copilot-cli.js         # GitHub Copilot adapter
│   ├── ollama.js              # Ollama API adapter
│   ├── openai-compat.js       # OpenAI-compatible API adapter
│   ├── claude-compat.js       # Anthropic-compatible API adapter
│   └── gemini-api.js          # Google AI Studio adapter
├── api/
│   ├── openai/router.js       # /v1/chat/completions, /v1/models
│   ├── anthropic/router.js    # /v1/messages
│   └── management/router.js   # /api/* management endpoints
├── public/                    # Web UI (vanilla HTML/CSS/JS)
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── app.js             # SPA router & utilities
│       └── pages/             # Dashboard, Providers, Logs, Apps, Docker
├── data/                      # Runtime (gitignored)
│   └── proxy.db               # SQLite database
├── package.json
└── .gitignore
```

## Prerequisites

Install the providers you want to use:

- **Claude CLI**: [claude.ai/download](https://claude.ai/download)
- **Gemini CLI**: via Google
- **Ollama**: [ollama.com](https://ollama.com)
- **OpenAI-compatible**: LM Studio, text-generation-webui, vLLM, etc.
- **GitHub Copilot**: `gh extension install github/gh-copilot`
- **Docker** (optional): for sandbox isolation
