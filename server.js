const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const crypto = require("crypto");

// --- CLI commands: --status, --stop, --restart, --install-service, --uninstall-service ---
// Handle these BEFORE loading anything else so they exit quickly.
const _isPkgEarly = typeof process.pkg !== 'undefined';
if (_isPkgEarly) {
  const { handleCliCommand } = require('./lib/service');
  // handleCliCommand handles: --help, --status, --stop, --restart, --install-service, --uninstall-service
  // AND bare run / --start when an instance is already running (shows status + help)
  if (handleCliCommand(process.argv.slice(2))) process.exit(0);
}

// --- Runtime extraction: extract embedded assets from pkg snapshot on first run ---
if (_isPkgEarly) {
  const { extractRuntime } = require('./lib/runtime-extract');
  extractRuntime();
}

// --- Debug mode: node server.js --debug  or  DEBUG=1 ---
const DEBUG = process.argv.includes('--debug') || process.env.DEBUG === '1';
const _isPkg = typeof process.pkg !== 'undefined';

function getLogBase() {
  return _isPkg ? path.dirname(process.execPath) : path.resolve(__dirname);
}

function debugLog(...args) {
  if (!DEBUG) return;
  const msg = `[DEBUG] ${args.join(' ')}`;
  console.log(msg);
  try {
    fs.appendFileSync(path.join(getLogBase(), 'debug.log'), `[${new Date().toISOString()}] ${msg}\n`);
  } catch {}
}

// --- Global error capture: writes error.log beside exe on crash ---
process.on('uncaughtException', (err) => {
  const logPath = path.join(getLogBase(), 'error.log');
  const msg = `[${new Date().toISOString()}] UNCAUGHT: ${err.stack}\n`;
  try { fs.appendFileSync(logPath, msg); } catch {}
  console.error('[FATAL]', err.stack);
  // In pkg debug mode, keep console open so user can read the error
  if (_isPkg && DEBUG) {
    console.error('\n  Press any key to exit...');
    try {
      fs.readSync(0, Buffer.alloc(1), 0, 1, null);
    } catch {}
  }
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  const logPath = path.join(getLogBase(), 'error.log');
  const msg = `[${new Date().toISOString()}] UNHANDLED REJECTION: ${reason instanceof Error ? reason.stack : reason}\n`;
  try { fs.appendFileSync(logPath, msg); } catch {}
  console.error('[FATAL REJECTION]', reason instanceof Error ? reason.stack : reason);
  if (_isPkg && DEBUG) {
    console.error('\n  Press any key to exit...');
    try {
      fs.readSync(0, Buffer.alloc(1), 0, 1, null);
    } catch {}
  }
  process.exit(1);
});

debugLog('Node.js', process.version);
debugLog('argv:', process.argv.join(' '));
debugLog('isPkg:', _isPkg);
debugLog('execPath:', process.execPath);
debugLog('cwd:', process.cwd());
debugLog('__dirname:', __dirname);
debugLog('platform:', process.platform, process.arch);

debugLog('Loading paths module...');
const { isPkg, getUploadsDir, getPublicDir, debugPaths } = require("./lib/paths");
if (DEBUG) debugPaths(debugLog);

debugLog('Loading provider-registry...');
const { createDefaultRegistry } = require("./lib/provider-registry");
debugLog('Loading logger...');
const { loggerMiddleware } = require("./lib/logger");
debugLog('Loading routers...');
const createOpenAIRouter = require("./api/openai/router");
const createAnthropicRouter = require("./api/anthropic/router");
const createManagementRouter = require("./api/management/router");
debugLog('All modules loaded.');

// Load config.json early so port override is applied before the server binds
debugLog('Loading config.json...');
const { loadConfigFile, createDefaultConfigFile, applyConfig } = require("./lib/config-loader");
const _userConfig = loadConfigFile();
debugLog('Config loaded:', _userConfig ? 'found' : 'not found');
if (_userConfig && _userConfig.port) process.env.PORT = String(_userConfig.port);

const config = require("./lib/config");

// Create default config.json template if it doesn't exist; apply providers/users/settings
createDefaultConfigFile();
if (_userConfig) applyConfig(_userConfig);

const app = express();
app.use(express.json({ limit: "50mb" }));

// Uploads directory
const UPLOADS_DIR = getUploadsDir();
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer file upload config
const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// Serve uploaded files
app.use("/uploads", express.static(UPLOADS_DIR));

// Apply multer to upload endpoint
app.post("/api/upload", upload.single("file"));

// Multer middleware for API endpoints (multipart file support)
// Parses files and puts attachment metadata on req.fileAttachments
const apiFileMiddleware = (req, res, next) => {
  // Only process multipart requests
  const contentType = req.headers["content-type"] || "";
  if (!contentType.includes("multipart/form-data")) return next();

  upload.array("files", 10)(req, res, (err) => {
    if (err) return res.status(400).json({ error: `File upload error: ${err.message}` });
    if (req.files && req.files.length > 0) {
      req.fileAttachments = req.files.map(f => ({
        url: `/uploads/${f.filename}`,
        name: f.originalname,
        mimetype: f.mimetype,
        size: f.size,
      }));
      // Parse JSON body fields from multipart form data
      if (typeof req.body.messages === "string") {
        try { req.body.messages = JSON.parse(req.body.messages); } catch { /* keep as-is */ }
      }
      if (typeof req.body.stream === "string") req.body.stream = req.body.stream === "true";
      if (typeof req.body.session_id === "undefined" && req.body.session_id) { /* already set */ }
    }
    next();
  });
};
app.post("/v1/chat/completions", apiFileMiddleware);
app.post("/v1/messages", apiFileMiddleware);

const PORT = process.env.PORT || 3199;

// Initialize provider registry (loads from DB + built-in fallbacks)
const registry = createDefaultRegistry();

// CORS middleware — dynamic origin control with two modes
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    const corsMode = config.getSetting("cors_mode") || "allow_all";
    let allowed = false;

    // Check apps table first (legacy cors_origin field)
    const apps = config.getAllApps();
    if (apps.some((a) => a.cors_origin && origin.startsWith(a.cors_origin))) {
      allowed = true;
    }

    if (corsMode === "allow_all") {
      // Allow all origins, auto-track as approved
      allowed = true;
      config.upsertCorsOrigin(origin, "approved");
    } else {
      // Controlled mode: check cors_origins table
      const record = config.getCorsOriginByOrigin(origin);
      if (record) {
        if (record.status === "approved") {
          allowed = true;
        }
        // Update last_seen
        config.upsertCorsOrigin(origin, record.status);
      } else {
        // New origin — record as pending
        config.upsertCorsOrigin(origin, "pending");
      }
    }

    if (allowed) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key, anthropic-version");
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// API token authentication middleware — only applies to /v1/* routes
app.use("/v1", (req, res, next) => {
  const authEnabled = config.getSetting("auth_enabled");
  // Auth disabled globally = skip all auth
  if (!authEnabled || authEnabled === "false") return next();

  // 1. Check for API token (Bearer or x-api-key)
  const authHeader = req.headers.authorization || "";
  const apiKeyHeader = req.headers["x-api-key"] || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const providedToken = bearerToken || apiKeyHeader;

  if (providedToken) {
    const tokenRecord = config.getApiTokenByToken(providedToken);
    if (!tokenRecord) {
      return res.status(403).json({ error: { message: "Invalid API token.", type: "authentication_error" } });
    }
    config.updateApiTokenLastUsed(tokenRecord.id);
    return next();
  }

  // 2. Fall back to session cookie (for web UI playground / embed preview)
  const { parseCookies } = require("./lib/auth");
  const cookies = parseCookies(req.headers.cookie || "");
  const sessionToken = cookies["session"];
  if (sessionToken) {
    const session = config.getSessionByToken(sessionToken);
    if (session) {
      req.user = { id: session.user_id, username: session.username, role: session.role };
      return next();
    }
  }

  return res.status(401).json({ error: { message: "Authorization required. Provide a Bearer token or x-api-key header.", type: "authentication_error" } });
});

// Request logging middleware
app.use(loggerMiddleware);

// List providers (compatibility)
app.get("/v1/providers", (req, res) => {
  res.json({
    providers: registry.listNames().map((name) => ({ name })),
  });
});

// Session compress endpoint (for API callers)
const { compressConversation } = require("./lib/context");
const { resolveProvider } = require("./lib/utils");
app.post("/v1/sessions/:id/compress", async (req, res) => {
  const conv = config.getConversation(req.params.id);
  if (!conv) return res.status(404).json({ error: "Session not found" });

  let provider = null;
  if (conv.provider_id) {
    const providerConfig = config.getProvider(conv.provider_id);
    if (providerConfig) provider = resolveProvider(providerConfig, registry);
  }
  if (!provider) {
    const defaultName = registry.getDefault();
    provider = registry.get(defaultName);
  }
  if (!provider) return res.status(500).json({ error: "No provider available" });

  try {
    const result = await compressConversation(req.params.id, provider, conv.model);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mount API routers
app.use(createOpenAIRouter(registry));
app.use(createAnthropicRouter(registry));
app.use(createManagementRouter(registry));

// Serve static Web UI
app.use(express.static(getPublicDir()));

// SPA fallback
app.get("*", (req, res) => {
  const indexPath = path.join(getPublicDir(), "index.html");
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.json({
        name: "local-ai-proxy",
        version: "1.0.0",
        providers: registry.listNames(),
        default_provider: registry.getDefault(),
        hint: "Web UI not available yet. Use /v1/chat/completions or /v1/messages",
      });
    }
  });
});

// Clean up expired sessions every hour
setInterval(() => {
  try { config.deleteExpiredSessions(); } catch { /* ignore */ }
}, 3600000);

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n  Local AI Proxy running at http://localhost:${PORT}`);
  const config = require("./lib/config");
  const dbDefault = config.getDefaultProvider();
  console.log(`  Default provider: ${dbDefault ? dbDefault.name : registry.getDefault()}`);
  console.log(`  Available providers: ${registry.listNames().join(", ")}`);

  // Log MCP server count
  try {
    const mcpServers = config.getAllMcpServers();
    const enabled = mcpServers.filter(s => s.enabled);
    if (mcpServers.length > 0) {
      console.log(`  MCP servers: ${enabled.length}/${mcpServers.length} enabled (lazy connect on first use)`);
    }
  } catch { /* mcp_servers table may not exist yet */ }
  console.log();

  // Write PID file for CLI management (all platforms)
  if (isPkg) {
    try {
      const { writePidFile } = require('./lib/service');
      writePidFile();
    } catch { /* ignore */ }
  }

  // System tray + auto-open browser when running as packaged executable
  const { initTray } = require('./lib/tray');
  initTray(PORT, shutdown, isPkg, DEBUG);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n  [ERROR] Port ${PORT} is already in use. Kill the other process or set a different PORT.\n`);
  } else {
    console.error(`\n  [ERROR] Server error: ${err.message}\n`);
  }
  process.exit(1);
});

// Graceful shutdown — release port before --watch restarts
function shutdown() {
  // Remove PID file (Linux)
  try {
    const { removePidFile } = require('./lib/service');
    removePidFile();
  } catch { /* ignore */ }
  // Kill tray icon
  try {
    const { killTray } = require('./lib/tray');
    killTray();
  } catch { /* ignore */ }
  // Disconnect MCP clients
  try {
    const mcpClientManager = require("./lib/mcp-client");
    mcpClientManager.disconnectAll().catch(() => {});
  } catch { /* ignore */ }
  // Kill persistent CLI processes
  try {
    const BaseCLIProvider = require("./providers/base-cli");
    if (BaseCLIProvider.persistentPool) BaseCLIProvider.persistentPool.killAll();
  } catch { /* ignore */ }
  server.close(() => process.exit(0));
  // Force exit if close takes too long
  setTimeout(() => process.exit(0), 1000);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
