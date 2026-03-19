<p align="center">
  <img src="assets/icon.svg" alt="Local AI Proxy" width="128" />
</p>

# Local AI Proxy

**[English](#features)** | **[中文](README.zh-CN.md)**

A unified API gateway that lets any app or website use local AI models through `http://localhost:3199` — compatible with both **OpenAI** and **Anthropic** API formats. Supports Claude, Gemini, Copilot, Ollama, LM Studio, and more.

> **One endpoint, all your AI models.** Point your app to `http://localhost:3199` and use any local AI just like calling the OpenAI API — no need to integrate each service separately.

## Quick Start

### Option 1: Download Pre-built Executable (Recommended)

Download the latest release for your platform from [GitHub Releases](https://github.com/lixuanxian/local-ai-proxy/releases):

| Platform | Download |
|---|---|
| Windows (x64) | `local-ai-proxy-win.zip` |
| macOS (Apple Silicon) | `local-ai-proxy-mac-arm64.zip` |
| macOS (Intel) | `local-ai-proxy-mac-x64.zip` |
| Linux (x64) | `local-ai-proxy-linux.zip` |

Extract and run — no installation needed. The app launches in the system tray and opens `http://localhost:3199` in your browser.

### Option 2: Run from Source

```bash
git clone https://github.com/lixuanxian/local-ai-proxy.git
cd local-ai-proxy
npm run setup   # install dependencies + build frontend
npm start       # start server on http://localhost:3199
```

## Features

- **Dual API compatibility** — OpenAI (`/v1/chat/completions`) and Anthropic (`/v1/messages`) formats
- **Multiple providers** — CLI-based (Claude, Gemini, Copilot) and API-based (Ollama, LM Studio, OpenAI-compatible, Anthropic-compatible, Gemini API)
- **Smart routing** — auto-detect provider from model name, or specify explicitly
- **Streaming** — SSE streaming support for both API formats
- **Built-in Chat** — conversational AI interface with streaming, file upload, skills, roles, and MCP tool calls
- **MCP Integration** — [Model Context Protocol](https://modelcontextprotocol.io/) support for tool use in AI chat
- **Web Dashboard** — provider management, request logs, token usage stats, app shortcuts
- **Authentication** — optional API token and session-based auth
- **CORS management** — configurable allow-all or per-origin approval
- **System tray** — runs in background with system tray icon, auto-opens browser

## Supported Providers

| Provider | Type | How it works |
|---|---|---|
| Claude CLI | CLI | Spawns local `claude` process |
| Gemini CLI | CLI | Spawns local `gemini` process |
| GitHub Copilot | CLI | Spawns local `copilot` process |
| Ollama | API | Proxies to local Ollama server |
| LM Studio | API | Proxies to local LM Studio server |
| OpenAI Compatible | API | Any OpenAI-compatible endpoint (vLLM, text-generation-webui, etc.) |
| Anthropic Compatible | API | Any Anthropic-compatible endpoint |
| Gemini API | API | Google AI Studio REST API |

Providers can be added, configured, and tested from the web dashboard.

### Prerequisites for CLI Providers

If you want to use CLI-based providers, install them first:

- **Claude CLI** — `npm install -g @anthropic-ai/claude-code` ([docs](https://github.com/anthropics/claude-code))
- **Gemini CLI** — `npm install -g @google/gemini-cli` ([docs](https://github.com/google/gemini-cli))
- **GitHub Copilot** — `npm install -g @github/copilot` ([docs](https://github.com/features/copilot/cli))

API-based providers (Ollama, LM Studio, etc.) only need a running server — configure the URL in the web dashboard.

## Usage

### Connect Your App

Point any OpenAI-compatible client to `http://localhost:3199`:

```python
# Python (openai package)
from openai import OpenAI

client = OpenAI(base_url="http://localhost:3199/v1", api_key="optional")
response = client.chat.completions.create(
    model="claude",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

```javascript
// JavaScript (fetch)
const response = await fetch("http://localhost:3199/v1/chat/completions", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "claude",
    messages: [{ role: "user", content: "Hello!" }]
  })
});
```

```bash
# cURL
curl http://localhost:3199/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"claude","messages":[{"role":"user","content":"Hello!"}]}'

# Streaming
curl http://localhost:3199/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"llama3","stream":true,"messages":[{"role":"user","content":"Hello!"}]}'

# Anthropic format
curl http://localhost:3199/v1/messages \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-sonnet-4-6","messages":[{"role":"user","content":"Hello!"}]}'
```

### Smart Model Routing

The proxy auto-detects which provider to use based on the model name:

| Model name pattern | Routes to |
|---|---|
| `claude-*`, `claude` | Claude CLI |
| `gemini-*`, `gemini` | Gemini CLI or Gemini API |
| `gpt-*`, `llama*`, `mistral*` | OpenAI-compatible (Ollama, LM Studio, etc.) |
| `copilot` | GitHub Copilot |

You can also specify the provider explicitly: `"provider": "ollama"`.

### API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/v1/chat/completions` | Chat (OpenAI format) |
| POST | `/v1/messages` | Chat (Anthropic format) |
| GET | `/v1/models` | List available models |

## Web Dashboard

Access the dashboard at **http://localhost:3199** to:

- **Dashboard** — view request stats, token usage charts, and provider health
- **Chat** — built-in conversational AI with streaming, file upload, roles, and MCP tool calls
- **Providers** — add, edit, test, and toggle providers
- **Logs** — search, filter, and export request logs
- **Apps** — manage app shortcut cards
- **Settings** — configure auth, CORS, MCP servers, keyboard shortcuts, and API tokens

## MCP Tool Integration

The built-in chat supports [Model Context Protocol](https://modelcontextprotocol.io/) for calling external tools during AI conversations:

- Add MCP servers in **Settings > MCP Servers** (supports HTTP and SSE transports)
- Tools are automatically discovered and made available in chat
- Tool calls and results are displayed inline in the conversation
- Supports iterative tool use (up to 10 rounds per message)

## Configuration

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3199` | Server port |
| `DEFAULT_PROVIDER` | `claude-cli` | Fallback provider when no match |
| `OPENAI_BASE_URL` | `http://localhost:1234` | Default OpenAI-compatible API address |
| `OPENAI_API_KEY` | _(empty)_ | API key for OpenAI-compatible backend |

### config.json

Place a `config.json` next to the executable to pre-configure providers and settings without the web UI:

```json
{
  "port": 3199,
  "providers": [
    {
      "name": "Claude CLI",
      "type": "claude-cli",
      "enabled": true,
      "is_default": true
    },
    {
      "name": "Ollama",
      "type": "openai-api",
      "base_url": "http://localhost:11434/v1",
      "enabled": true
    }
  ],
  "settings": {
    "auth_enabled": "false",
    "cors_mode": "allow_all",
    "logging_enabled": "true"
  }
}
```

### Authentication

Authentication is disabled by default. To enable:

1. Open **Settings** in the web dashboard
2. Enable **Authentication**
3. Set up an admin account on first login

When enabled, API requests require a Bearer token: `Authorization: Bearer your-api-token`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, build instructions, and architecture overview.

## License

MIT
