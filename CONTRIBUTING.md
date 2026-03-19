# Contributing to Local AI Proxy

## Development Setup

```bash
git clone https://github.com/lixuanxian/local-ai-proxy.git
cd local-ai-proxy
npm run setup        # install all dependencies + build frontend
```

### Dev Servers

```bash
npm run dev          # backend + frontend with hot reload
npm run dev:server   # backend only (file watching)
npm run dev:web      # frontend only (Vite HMR on port 5173, proxies API to :3199)
```

### Keyboard Shortcuts (Web UI)

| Key | Action |
|---|---|
| `1`-`7` | Navigate pages |
| `t` | Toggle dark/light theme |
| `b` | Toggle sidebar |
| `Ctrl+K` | Command palette |

## Building Standalone Executables

The build pipeline uses **esbuild** to bundle into a single CJS file, then **@yao-pkg/pkg** to create standalone executables.

```bash
npm run dist:win       # Windows (x64, includes icon)
npm run dist:mac       # macOS (arm64 + x64)
npm run dist:mac-arm64 # macOS (arm64 only)
npm run dist:mac-x64   # macOS (x64 only)
npm run dist:linux     # Linux (x64)
npm run dist:debug     # Quick Windows debug build (skips frontend)
```

Output goes to `dist/`. The build script (`scripts/dist.js`) orchestrates the full pipeline:

1. Build icon (Windows only)
2. Build frontend
3. Bundle server via esbuild
4. Package exe via pkg
5. Copy companion files (native modules, SDK, system tray)
6. Embed icon into exe (Windows only)
7. Verify companion files & create zip

All platform configurations are centralized in `scripts/config.js`.

## Tech Stack

- **Backend:** Node.js + Express, synchronous SQLite (`better-sqlite3`)
- **Frontend:** React 19 + Ant Design 6, Vite, ESLint
- **Packaging:** esbuild + @yao-pkg/pkg
- **System tray:** systray2

## Project Structure

```
server.js              # Express entry point
lib/                   # Backend modules (db, config, providers, logger, etc.)
providers/             # AI provider adapters (CLI and API based)
api/                   # Route handlers (openai, anthropic, management)
web/                   # React frontend (Vite + Ant Design)
scripts/               # Build & packaging scripts
  config.js            # Shared platform configuration
  dist.js              # Unified build pipeline orchestrator
  build-server.js      # esbuild bundler
  build-icon.js        # SVG to ICO converter
  post-pkg.js          # Companion file copier
  set-icon.js          # Windows exe icon embedder
  pack-dist.js         # Zip packer with verification
public/                # Built frontend assets (generated)
data/                  # Runtime SQLite database (gitignored)
```
