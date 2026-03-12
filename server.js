const express = require("express");
const path = require("path");
const { createDefaultRegistry } = require("./lib/provider-registry");
const { loggerMiddleware } = require("./lib/logger");
const createOpenAIRouter = require("./api/openai/router");
const createAnthropicRouter = require("./api/anthropic/router");
const createManagementRouter = require("./api/management/router");

const config = require("./lib/config");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3199;

// Initialize provider registry (loads from DB + built-in fallbacks)
const registry = createDefaultRegistry();

// CORS middleware — reads allowed origins from apps table
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    const apps = config.getAllApps();
    const allowed = apps.some((a) => a.cors_origin && origin.startsWith(a.cors_origin));
    if (allowed) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key, anthropic-version");
    }
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Request logging middleware
app.use(loggerMiddleware);

// List providers (compatibility)
app.get("/v1/providers", (req, res) => {
  res.json({
    providers: registry.listNames().map((name) => ({ name })),
  });
});

// Mount API routers
app.use(createOpenAIRouter(registry));
app.use(createAnthropicRouter(registry));
app.use(createManagementRouter(registry));

// Serve static Web UI
app.use(express.static(path.join(__dirname, "public")));

// SPA fallback
app.get("*", (req, res) => {
  const indexPath = path.join(__dirname, "public", "index.html");
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

app.listen(PORT, () => {
  console.log(`\n  Local AI Proxy running at http://localhost:${PORT}`);
  console.log(`  Default provider: ${registry.getDefault()}`);
  console.log(`  Available providers: ${registry.listNames().join(", ")}\n`);
});
