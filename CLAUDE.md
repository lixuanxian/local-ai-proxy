# Local AI Proxy

Unified API gateway routing chat requests to multiple AI providers. React web dashboard, SQLite persistence, built-in chat with MCP tools, standalone exe packaging.

**Port:** 3199 (`PORT` env var) | **No tests** | **No TypeScript**

## Stack

- **Backend:** Node.js + Express, synchronous `better-sqlite3` (WAL mode)
- **Frontend:** React 19 + Ant Design 6, Vite 7, custom CSS design system (`web/src/styles.css`)
- **Streaming:** SSE via `res.write()`, `text/event-stream`
- **Packaging:** esbuild → @yao-pkg/pkg → standalone exe (see `docs/packaging.md`)

## Structure

```
server.js              # Express entry point
lib/                   # db, config, provider-registry, logger, mcp-client, tray, service, paths
providers/             # base-cli, base-api, claude-cli, openai-compat, claude-compat, gemini-*, copilot-cli
api/                   # openai/router, anthropic/router, management/router
web/                   # React frontend (Vite + Ant Design)
scripts/               # Build & packaging (config, dist, build-server, post-pkg, set-icon, pack-dist)
```

## Commands

```bash
npm run dev            # Backend + frontend hot reload
npm run dev:server     # Backend only
cd web && npm run dev  # Frontend only (port 5173, proxies to :3199)
npm run dist:win       # Build Windows exe (see docs/packaging.md)
```

## Architecture

- **Providers:** adapter pattern — `BaseCLIProvider` (spawns CLI) / `BaseAPIProvider` (HTTP + SSE)
- **Routing:** explicit `provider` param → model name regex match → default
- **DB tables:** providers, settings, request_logs, apps, docker_configs, conversations, messages, skills, mcp_servers
- **Frontend:** lazy-loaded pages, CSS custom properties dark/light theme, Ant Design ConfigProvider tokens

## Docs

- [docs/api-endpoints.md](docs/api-endpoints.md) — API routes + env vars
- [docs/frontend.md](docs/frontend.md) — Frontend, chat, MCP integration
- [docs/packaging.md](docs/packaging.md) — Build pipeline, pkg constraints, CI/CD, Windows console, tray
