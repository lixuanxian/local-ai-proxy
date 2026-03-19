# API Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/v1/chat/completions` | POST | OpenAI-compatible chat |
| `/v1/messages` | POST | Anthropic-compatible chat |
| `/v1/models` | GET | List providers as models |
| `/api/info` | GET | System info (port, uptime, providers) |
| `/api/health` | GET | Health check |
| `/api/settings` | GET/PUT | Settings management |
| `/api/providers` | CRUD | Provider management |
| `/api/providers/bulk/toggle` | POST | Bulk enable/disable |
| `/api/providers/:id/test` | POST | Connection test |
| `/api/logs` | GET/DELETE | Log query (search, model, status filters) |
| `/api/logs/stats` | GET | Aggregate stats (includes token usage) |
| `/api/logs/stats/hourly` | GET | 24h hourly breakdown |
| `/api/logs/stats/providers` | GET | Stats by provider |
| `/api/apps` | CRUD | App management + reorder |
| `/api/conversations` | CRUD | Conversation management (list, create, update, delete) |
| `/api/conversations/:id/messages` | POST | Send message + get AI response (supports SSE streaming) |
| `/api/skills` | CRUD | Skills management (prompt templates) |
| `/api/mcp-servers` | CRUD | MCP server management |
| `/api/mcp-servers/:id/test` | POST | Test MCP server connection |
| `/api/mcp-servers/:id/tools` | GET | List discovered tools from MCP server |
| `/api/mcp-servers/status` | GET | Connection status of all MCP servers |
| `/api/upload` | POST | File/image upload (multipart, stored in `data/uploads/`) |

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | 3199 | Server port |
| `DEFAULT_PROVIDER` | "claude-cli" | Initial default provider |
| `OPENAI_BASE_URL` | http://localhost:1234 | OpenAI-compat endpoint |
| `OPENAI_API_KEY` | (empty) | API key for OpenAI-compat |
