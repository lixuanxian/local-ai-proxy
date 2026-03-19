# Packaging & Distribution

Uses **esbuild** to bundle into a single CJS file, then **@yao-pkg/pkg** to create standalone executables.

## Build Pipeline

All `dist:*` commands are unified through `scripts/dist.js`, which orchestrates the full pipeline. Platform configurations (targets, output names, zip names) are centralized in `scripts/config.js`.

```bash
npm run dist:win       # Windows (x64, includes icon)
npm run dist:mac       # macOS (arm64 + x64)
npm run dist:mac-arm64 # macOS (arm64 only)
npm run dist:mac-x64   # macOS (x64 only)
npm run dist:linux     # Linux (x64)
npm run dist:debug     # Quick Windows debug build (skips frontend, launches with DEBUG=1)
```

Build steps executed by `dist.js` (in order):
1. `build-icon.js` — SVG → ICO (Windows only, requires `sharp` + `png-to-ico`)
2. `cd web && npm run build` — Vite builds frontend to `public/` (skippable with `--skip-web`)
3. `build-server.js` — esbuild bundles `server.js` → `dist/server.bundle.cjs` (also pre-bundles Claude Agent SDK ESM→CJS)
4. `@yao-pkg/pkg` — packages bundle into standalone exe (target: `node22-{platform}`)
5. `post-pkg.js` — copies companion files next to exe (native addons, public/, SDK, systray2, vendor/)
6. `set-icon.js` — embeds ICO + version info into Windows exe via `resedit` + `pe-library`
7. `pack-dist.js` — verifies required companion files exist, then creates platform-specific zip archive

## Build Scripts

| File | Purpose |
|---|---|
| `scripts/config.js` | Shared platform configuration — single source of truth for targets, exe names, zip names, CI matrix |
| `scripts/dist.js` | Unified build orchestrator — runs all steps in order for a given platform |
| `scripts/build-server.js` | esbuild config — bundles server.js into `dist/server.bundle.cjs`, cleans dist/ (preserves data/) |
| `scripts/build-icon.js` | Generates ICO from SVG for Windows exe (sharp + png-to-ico) |
| `scripts/post-pkg.js` | Copies companion files: `better_sqlite3.node`, `public/`, `icon.ico`, `claude-agent-sdk.cjs`, `cli.js`, `vendor/`, `systray2` + deps (platform-specific traybin only) |
| `scripts/set-icon.js` | Embeds icon + version info into Windows exe via resedit (noGrow to preserve pkg VFS) |
| `scripts/pack-dist.js` | Verifies companion files (required: exe, sqlite native, public/, systray2; optional: SDK, icon, vendor) then creates distribution zip |
| `lib/paths.js` | Path resolution — returns real filesystem paths in pkg mode, project-relative in dev |
| `lib/runtime-extract.js` | Extracts `better_sqlite3.node`, `public/`, `icon.ico` from pkg snapshot on first run (fallback for companion files) |

## pkg Constraints

- **Native `.node` files** (better-sqlite3) must exist on real filesystem, not in pkg snapshot — `post-pkg.js` copies them next to the exe, `runtime-extract.js` also extracts from snapshot as fallback
- **Static assets** (`public/`) must also be on real filesystem for Express static serving — `post-pkg.js` copies the directory
- **ESM packages** (`@anthropic-ai/claude-agent-sdk`) — pkg can't handle ESM `import()`. Solved by pre-bundling to CJS in `build-server.js`, companion file `claude-agent-sdk.cjs` + `cli.js` next to exe
- **Provider requires** must use static string literals (not variables) so esbuild/pkg can resolve them — `provider-registry.js` uses lazy closures: `() => require("../providers/xxx")`
- **External packages** in esbuild: `better-sqlite3` (native), `@anthropic-ai/claude-agent-sdk` (ESM-only), `systray2` (native + Go binary), dev deps
- **systray2** — copies only current platform's tray binary (`tray_windows_release.exe` / `tray_darwin_release` / `tray_linux_release`)
- **Node.js SEA not viable** — no VFS for `express.static()`, ESM `import()` fails for non-builtins. Revisit when `node:vfs` lands (PR #61478)

## CI/CD (GitHub Actions)

`.github/workflows/release.yml` — builds and releases for all platforms:
- **Triggers:** push tag `v*` (creates release), `workflow_dispatch` (manual test builds)
- **Matrix:** `{ os, platform }` — platform config (exe name, zip name) resolved from `scripts/config.js` at runtime
- **Build:** calls `node scripts/dist.js <platform>` — same pipeline as local builds
- **Smoke test:** starts packaged exe, polls `/api/health` for up to 30s
- **Release:** downloads all platform zips via glob (`artifacts/**/*.zip`), creates GitHub Release with auto-generated notes

## Windows Console Management

The Windows exe uses **CONSOLE subsystem** (not GUI) so child processes inherit the parent's console instead of creating new visible windows (which would cause flashing). The console is hidden at startup via `GetForegroundWindow()` + `ShowWindow(SW_HIDE)` through PowerShell.

Key design decisions:
- **CONSOLE subsystem** — `set-icon.js` keeps subsystem=3 so CLI providers (claude, gemini, copilot) inherit a console and don't flash new windows
- **GetForegroundWindow()** — `GetConsoleWindow()` returns a pseudo-handle on Windows Terminal that `ShowWindow` can't control. `GetForegroundWindow()` at startup captures the real terminal window handle
- **PowerShell + EncodedCommand** — Win32 API calls (ShowWindow, GetConsoleWindow) via `Add-Type` with `-EncodedCommand` (base64 UTF-16LE) to avoid shell quoting issues
- **Log Viewer instead of real console** — "Show Console" in tray spawns a detached `powershell Get-Content -Wait` window tailing `debug.log`. Closing it doesn't kill the main process (unlike closing the real console which triggers `CTRL_CLOSE_EVENT` → process termination)
- **stdout/stderr tee** — In pkg mode, stdout/stderr are tee'd to `debug.log` so the log viewer has content
- **Process tree cleanup** — "Hide Console" uses `taskkill /T /F` to kill the entire cmd.exe + PowerShell tree

## System Tray (`lib/tray.js`)

Tray menu: Open Dashboard, View Logs, Show/Hide Console (Windows), Start on Login, Restart, Quit.

- Uses `systray2` (Go binary) — companion files must be on real filesystem
- `openBrowser()` uses `rundll32 url.dll,FileProtocolHandler` on Windows to avoid console flash
- `openLogFile()` also uses `rundll32` for the same reason
- Auto-start: Windows registry (`HKCU\...\Run`), macOS LaunchAgent plist

## Debug Mode

Activate with `--debug` flag or `DEBUG=1` env var:
- Logs all path resolution, module loading, and DB initialization to console and `debug.log`
- Console hide is delayed 3s so startup messages can be read
- In pkg mode, fatal errors pause with "Press any key to exit" so the console stays open
- `lib/paths.js:debugPaths()` dumps all resolved paths with existence checks
