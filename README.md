<p align="center">
  <img src="assets/icon.svg" alt="Local AI Proxy" width="128" />
</p>


# Local AI Proxy

**[English](#features)** | **[中文](README.zh-CN.md)**

Let any website access local AI via `http://localhost:3199` — a unified API gateway that routes chat requests to multiple AI providers (Claude, Gemini, Copilot, Ollama, etc.), compatible with both **OpenAI** and **Anthropic** API formats. Comes with a web dashboard, built-in chat UI, MCP tool integration, and standalone executable packaging.

> **Core idea:** Point your app's API endpoint to `http://localhost:3199` and use local AI models just like calling the OpenAI API — no need to integrate each AI service separately.

## Features

- **Dual API compatibility** — OpenAI (`/v1/chat/completions`) and Anthropic (`/v1/messages`) formats
- **Multiple providers** — CLI-based (Claude, Gemini, Copilot) and API-based (Ollama, OpenAI-compat, Anthropic-compat, Gemini API)
- **Smart routing** — auto-detect provider from model name, or set explicitly
- **Streaming** — SSE streaming for both API formats
- **Built-in Chat** — conversational AI interface with streaming, file upload, skills, roles, and tool calls
- **MCP Integration** — Model Context Protocol support for tool use in AI chat
- **Web Dashboard** — provider management, request logs, token stats, app cards, settings
- **Authentication** — optional API token and session-based auth with admin setup
- **CORS management** — configurable allow-all or controlled mode with per-origin approval
- **SQLite persistence** — providers, settings, logs, conversations, skills, MCP servers
- **Standalone executable** — package as a single exe for Windows, macOS, and Linux
- **System tray** — runs in system tray when packaged, auto-opens browser

## Quick Start

```bash
# Install dependencies and build frontend
npm run setup

# Start the server
npm start
```

Open **http://localhost:3199** for the web dashboard.

### Development

```bash
# Backend + frontend dev servers with hot reload
npm run dev

# Backend only (with file watching)
npm run dev:server

# Frontend only (Vite HMR on port 5173, proxies API to :3199)
cd web && npm run dev
```

## Supported Providers

| Provider | Type | How it works |
|---|---|---|
| Claude CLI | `claude-cli` | Spawns `claude` process |
| Gemini CLI | `gemini-cli` | Spawns `gemini` process |
| GitHub Copilot | `copilot-cli` | Spawns `copilot` process |
| Ollama | `openai-api` | HTTP proxy to local Ollama API |
| OpenAI Compatible | `openai-api` | Any OpenAI-compatible API (LM Studio, vLLM, etc.) |
| Anthropic Compatible | `anthropic-api` | Any Anthropic-compatible API |
| Gemini API | `gemini-api` | Google AI Studio REST API |

New providers can be added via the web UI or `config.json`.

## API Endpoints

### Proxy API

| Method | Path | Description |
|---|---|---|
| POST | `/v1/chat/completions` | Chat (OpenAI format) |
| POST | `/v1/messages` | Chat (Anthropic format) |
| GET | `/v1/models` | List providers as models |
| GET | `/v1/providers` | List providers |
| POST | `/v1/sessions/:id/compress` | Compress conversation context |

### Management API

| Method | Path | Description |
|---|---|---|
| GET | `/api/info` | System info (port, uptime, providers) |
| GET | `/api/health` | Health check |
| GET/PUT | `/api/settings` | Settings management |
| CRUD | `/api/providers` | Provider configuration |
| POST | `/api/providers/bulk/toggle` | Bulk enable/disable |
| POST | `/api/providers/:id/test` | Test provider connectivity |
| GET/DELETE | `/api/logs` | Request logs (search, model, status filters) |
| GET | `/api/logs/stats` | Aggregate stats (includes token usage) |
| GET | `/api/logs/stats/hourly` | 24h hourly breakdown |
| GET | `/api/logs/stats/providers` | Stats by provider |
| CRUD | `/api/apps` | App management + reorder |
| CRUD | `/api/conversations` | Conversation management |
| POST | `/api/conversations/:id/messages` | Send message + get AI response (SSE streaming) |
| CRUD | `/api/skills` | Skills management (prompt templates) |
| CRUD | `/api/mcp-servers` | MCP server management |
| POST | `/api/mcp-servers/:id/test` | Test MCP server connection |
| GET | `/api/mcp-servers/:id/tools` | List tools from MCP server |
| POST | `/api/upload` | File/image upload (multipart) |

## Examples

```bash
# OpenAI format
curl http://localhost:3199/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"provider":"claude","messages":[{"role":"user","content":"hello"}]}'

# Anthropic format
curl http://localhost:3199/v1/messages \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-sonnet-4-6","messages":[{"role":"user","content":"hello"}]}'

# Auto-detect provider from model name
curl http://localhost:3199/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"hello"}]}'

# Streaming
curl http://localhost:3199/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"llama3","stream":true,"messages":[{"role":"user","content":"hello"}]}'

# With API token authentication
curl http://localhost:3199/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-token" \
  -d '{"model":"claude","messages":[{"role":"user","content":"hello"}]}'
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3199` | Server port |
| `DEFAULT_PROVIDER` | `claude` | Fallback provider |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama API address |
| `OPENAI_BASE_URL` | `http://localhost:1234` | OpenAI-compatible API address |
| `OPENAI_API_KEY` | _(empty)_ | API key for OpenAI-compatible backend |

### config.json

A `config.json` file next to the executable (or project root in dev) is loaded on startup. This allows pre-configuring providers, users, and settings without the web UI:

```json
{
  "port": 3199,
  "providers": [
    {
      "name": "Claude CLI",
      "type": "claude-cli",
      "base_url": "",
      "api_key": "",
      "default_model": "claude-connect-4-6",
      "enabled": true,
      "is_default": true
    }
  ],
  "users": [
    { "username": "admin", "password": "changeme", "role": "admin" }
  ],
  "settings": {
    "auth_enabled": "false",
    "cors_mode": "allow_all",
    "logging_enabled": "true"
  }
}
```

## Web UI

- **Dashboard** — stats, charts, token usage, provider overview, app cards
- **Providers** — card-based provider management with search/filter, connectivity testing
- **Models** — browse and manage available models across providers
- **Logs** — log table with search, export, status filter
- **Apps** — app cards with reordering
- **Settings** — configuration, keyboard shortcuts, MCP servers, auth, CORS, API tokens

### Keyboard Shortcuts

| Key | Action |
|---|---|
| `1`-`7` | Navigate pages |
| `t` | Toggle dark/light theme |
| `b` | Toggle sidebar |
| `Ctrl+K` | Command palette |

## MCP Integration

Full [Model Context Protocol](https://modelcontextprotocol.io/) client integration for tool use in AI chat:

- Supports Streamable HTTP and SSE transports
- Lazy connection — connects on first use, not startup
- Tool discovery and caching per connection
- Iterative tool execution loop (max 10 iterations)
- Auto-reconnect on failure
- Manage servers via the Settings page

## Building Standalone Executables

The project uses **esbuild** to bundle into a single CJS file, then **@yao-pkg/pkg** to create standalone executables:

```bash
# Windows (includes icon)
npm run dist:win

# macOS (arm64 + x64)
npm run dist:mac

# Linux (x64)
npm run dist:linux

# Quick debug build (Windows)
npm run dist:debug
```

Output goes to `dist/`. The executable runs with a system tray icon and auto-opens the browser.


## Prerequisites

Install the providers you want to use:

- **Claude CLI**：`curl -fsSL https://claude.ai/install.sh | bash` OR access [claude.ai](https://github.com/anthropics/claude-code)
- **Gemini CLI**：`npm install -g @google/gemini-cli` OR access [gemini-cli](https://github.com/google/gemini/gemini-cli)
- **GitHub Copilot**：`npm install -g @github/copilot` OR access [copilot.github.com](https://github.com/features/copilot/cli)
## Tech Stack

- **Backend:** Node.js + Express, synchronous SQLite (`better-sqlite3`)
- **Frontend:** React 19 + Ant Design 6, Vite, ESLint
- **Packaging:** esbuild + @yao-pkg/pkg

## License

MIT
