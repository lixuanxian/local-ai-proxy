const { Router } = require("express");
const config = require("../../lib/config");
const { queryLogs, getStats, clearLogs } = require("../../lib/logger");
const docker = require("../../lib/docker");

module.exports = function createManagementRouter(providerRegistry) {
  const router = Router();

  // ---- System Info ----
  router.get("/api/info", (req, res) => {
    res.json({
      name: "local-ai-proxy",
      version: "1.0.0",
      providers: providerRegistry.listNames(),
      default_provider: providerRegistry.getDefault(),
    });
  });

  router.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      providers: providerRegistry.listNames().length,
      uptime: process.uptime(),
    });
  });

  // ---- Settings ----
  router.get("/api/settings", (req, res) => {
    res.json(config.getAllSettings());
  });

  router.put("/api/settings/:key", (req, res) => {
    const { key } = req.params;
    const { value } = req.body;
    if (value === undefined) return res.status(400).json({ error: "value is required" });
    config.setSetting(key, value);
    res.json({ key, value });
  });

  // ---- Providers ----
  router.get("/api/providers", (req, res) => {
    const providers = config.getAllProviders();
    // Hide API keys in listing
    res.json(providers.map((p) => ({ ...p, api_key: p.api_key ? "***" : null })));
  });

  router.post("/api/providers", (req, res) => {
    try {
      const id = config.saveProvider(req.body);
      res.status(201).json({ id, ...config.getProvider(id) });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get("/api/providers/:id", (req, res) => {
    const provider = config.getProvider(req.params.id);
    if (!provider) return res.status(404).json({ error: "Provider not found" });
    res.json({ ...provider, api_key: provider.api_key ? "***" : null });
  });

  router.put("/api/providers/:id", (req, res) => {
    const existing = config.getProvider(req.params.id);
    if (!existing) return res.status(404).json({ error: "Provider not found" });
    // If api_key is "***", keep the old one
    if (req.body.api_key === "***") req.body.api_key = existing.api_key;
    config.saveProvider({ ...req.body, id: req.params.id });
    res.json(config.getProvider(req.params.id));
  });

  router.delete("/api/providers/:id", (req, res) => {
    config.deleteProvider(req.params.id);
    res.json({ ok: true });
  });

  router.put("/api/providers/:id/default", (req, res) => {
    const provider = config.getProvider(req.params.id);
    if (!provider) return res.status(404).json({ error: "Provider not found" });
    config.setDefaultProvider(req.params.id);
    res.json({ ok: true, default_provider: req.params.id });
  });

  router.post("/api/providers/:id/test", async (req, res) => {
    const providerConfig = config.getProvider(req.params.id);
    if (!providerConfig) return res.status(404).json({ error: "Provider not found" });

    // Try to find the provider in the registry and send a simple test message
    const provider = providerRegistry.get(providerConfig.id) || providerRegistry.get(providerConfig.name?.toLowerCase());
    if (!provider) {
      return res.json({ ok: false, error: "Provider not loaded in registry" });
    }

    const start = Date.now();
    try {
      await provider.chat([{ role: "user", content: "Hi" }], { model: providerConfig.default_model });
      res.json({ ok: true, latency_ms: Date.now() - start });
    } catch (err) {
      res.json({ ok: false, error: err.message, latency_ms: Date.now() - start });
    }
  });

  // ---- Logs ----
  router.get("/api/logs", (req, res) => {
    const { page, limit, provider, since, until } = req.query;
    res.json(queryLogs({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
      provider, since, until,
    }));
  });

  router.get("/api/logs/stats", (req, res) => {
    res.json(getStats());
  });

  router.delete("/api/logs", (req, res) => {
    clearLogs();
    res.json({ ok: true });
  });

  // ---- Apps ----
  router.get("/api/apps", (req, res) => {
    res.json(config.getAllApps());
  });

  router.post("/api/apps", (req, res) => {
    try {
      const id = config.saveApp(req.body);
      res.status(201).json(config.getApp(id));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.put("/api/apps/:id", (req, res) => {
    if (!config.getApp(req.params.id)) return res.status(404).json({ error: "App not found" });
    config.saveApp({ ...req.body, id: req.params.id });
    res.json(config.getApp(req.params.id));
  });

  router.delete("/api/apps/:id", (req, res) => {
    config.deleteApp(req.params.id);
    res.json({ ok: true });
  });

  router.put("/api/apps/reorder", (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: "ids must be an array" });
    config.reorderApps(ids);
    res.json({ ok: true });
  });

  // ---- Docker Configs ----
  router.get("/api/docker/configs", (req, res) => {
    res.json(config.getAllDockerConfigs());
  });

  router.post("/api/docker/configs", (req, res) => {
    try {
      const id = config.saveDockerConfig(req.body);
      res.status(201).json(config.getDockerConfig(id));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.put("/api/docker/configs/:id", (req, res) => {
    if (!config.getDockerConfig(req.params.id)) return res.status(404).json({ error: "Config not found" });
    config.saveDockerConfig({ ...req.body, id: req.params.id });
    res.json(config.getDockerConfig(req.params.id));
  });

  router.delete("/api/docker/configs/:id", (req, res) => {
    config.deleteDockerConfig(req.params.id);
    res.json({ ok: true });
  });

  router.get("/api/docker/status", (req, res) => {
    const info = docker.getDockerInfo();
    const containers = info.connected ? docker.listContainers() : [];
    res.json({
      connected: info.connected,
      version: info.version,
      containers,
      message: info.connected ? `Docker ${info.version}` : "Docker is not running or not installed",
    });
  });

  router.post("/api/docker/test", async (req, res) => {
    if (!docker.isDockerAvailable()) {
      return res.json({ ok: false, error: "Docker is not available" });
    }
    try {
      const result = await docker.runInContainer(
        { image: "alpine:latest", cpu_limit: "0.5", memory_limit: "64m", timeout_seconds: 30 },
        "echo 'Docker sandbox works!'"
      );
      res.json({ ok: result.exitCode === 0, output: result.stdout.trim(), error: result.stderr || null });
    } catch (err) {
      res.json({ ok: false, error: err.message });
    }
  });

  // ---- Docker Sandbox Management ----

  // List all sandbox containers
  router.get("/api/docker/sandboxes", (req, res) => {
    const containers = docker.listSandboxContainers();
    res.json(containers);
  });

  // Start a sandbox from a config
  router.post("/api/docker/sandboxes/:configId/start", async (req, res) => {
    const dockerConfig = config.getDockerConfig(req.params.configId);
    if (!dockerConfig) return res.status(404).json({ error: "Config not found" });
    if (!docker.isDockerAvailable()) return res.json({ ok: false, error: "Docker is not available" });

    // Check if already running
    const status = docker.getSandboxStatus(req.params.configId);
    if (status.running) {
      return res.json({ ok: true, message: "Sandbox already running", ...status });
    }

    try {
      const result = await docker.createSandbox({ ...dockerConfig, id: req.params.configId });
      res.json({ ok: true, ...result });
    } catch (err) {
      res.json({ ok: false, error: err.message });
    }
  });

  // Stop a sandbox
  router.post("/api/docker/sandboxes/:configId/stop", async (req, res) => {
    const status = docker.getSandboxStatus(req.params.configId);
    if (!status.running) return res.json({ ok: true, message: "Sandbox not running" });

    try {
      await docker.removeSandbox(status.name);
      res.json({ ok: true });
    } catch (err) {
      res.json({ ok: false, error: err.message });
    }
  });

  // Get sandbox status for a config
  router.get("/api/docker/sandboxes/:configId/status", (req, res) => {
    const status = docker.getSandboxStatus(req.params.configId);
    res.json(status);
  });

  // Execute a command in a sandbox
  router.post("/api/docker/sandboxes/:configId/exec", async (req, res) => {
    const { command, workdir, timeout } = req.body;
    if (!command) return res.status(400).json({ error: "command is required" });

    const status = docker.getSandboxStatus(req.params.configId);
    if (!status.running) return res.status(400).json({ error: "Sandbox is not running" });

    try {
      const result = await docker.execInSandbox(status.name, command, { workdir, timeout });
      res.json(result);
    } catch (err) {
      res.json({ error: err.message, exitCode: -1 });
    }
  });

  // Get sandbox logs
  router.get("/api/docker/sandboxes/:configId/logs", (req, res) => {
    const tail = parseInt(req.query.tail) || 100;
    const status = docker.getSandboxStatus(req.params.configId);
    if (!status.running) return res.json({ logs: "", error: "Sandbox is not running" });

    const logs = docker.getSandboxLogs(status.name, tail);
    res.json({ logs });
  });

  // Pull image for a config
  router.post("/api/docker/configs/:id/pull", async (req, res) => {
    const dockerConfig = config.getDockerConfig(req.params.id);
    if (!dockerConfig) return res.status(404).json({ error: "Config not found" });

    try {
      const output = await docker.pullImage(dockerConfig.image);
      res.json({ ok: true, output });
    } catch (err) {
      res.json({ ok: false, error: err.message });
    }
  });

  return router;
};
