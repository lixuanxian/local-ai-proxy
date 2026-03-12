const { Router } = require("express");
const config = require("../../lib/config");
const { queryLogs, getStats, getHourlyStats, getProviderStats, getModelStats, clearLogs } = require("../../lib/logger");
const docker = require("../../lib/docker");

module.exports = function createManagementRouter(providerRegistry) {
  const router = Router();

  // ---- System Info ----
  router.get("/api/info", (req, res) => {
    const settings = config.getAllSettings();
    res.json({
      name: "local-ai-proxy",
      version: "1.0.0",
      providers: providerRegistry.listNames(),
      default_provider: providerRegistry.getDefault(),
      port: settings.port || process.env.PORT || 3199,
      uptime: Math.floor(process.uptime()),
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

  router.post("/api/providers/bulk/toggle", (req, res) => {
    const { ids, enabled } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: "ids must be an array" });
    if (typeof enabled !== 'boolean') return res.status(400).json({ error: "enabled must be a boolean" });
    config.bulkToggleProviders(ids, enabled);
    res.json({ ok: true, updated: ids.length });
  });

  router.post("/api/providers/:id/test", async (req, res) => {
    const providerConfig = config.getProvider(req.params.id);
    if (!providerConfig) return res.status(404).json({ error: "Provider not found" });

    // Map DB type/id to registry name
    const typeToRegistry = {
      'cli': 'claude', 'codex-cli': 'codex', 'aider-cli': 'aider',
      'opencode-cli': 'opencode', 'openai-api': 'openai', 'ollama': 'ollama',
      'gemini-api': 'gemini', 'anthropic-api': 'openai',
    };
    // Try: exact id → command name → type mapping → lowercase name
    const provider = providerRegistry.get(providerConfig.id)
      || providerRegistry.get(providerConfig.command)
      || providerRegistry.get(typeToRegistry[providerConfig.type])
      || providerRegistry.get(providerConfig.name?.toLowerCase());
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
    const { page, limit, provider, model, search, status, since, until } = req.query;
    res.json(queryLogs({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
      provider, model, search, status, since, until,
    }));
  });

  router.get("/api/logs/stats", (req, res) => {
    res.json(getStats());
  });

  router.get("/api/logs/stats/hourly", (req, res) => {
    res.json(getHourlyStats());
  });

  router.get("/api/logs/stats/providers", (req, res) => {
    res.json(getProviderStats());
  });

  router.get("/api/logs/stats/models", (req, res) => {
    res.json(getModelStats());
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

  // ---- Conversations ----
  router.get("/api/conversations", (req, res) => {
    const { search } = req.query;
    res.json(config.getAllConversations(search));
  });

  router.post("/api/conversations", (req, res) => {
    try {
      const id = config.saveConversation(req.body);
      res.status(201).json(config.getConversation(id));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get("/api/conversations/:id", (req, res) => {
    const conv = config.getConversation(req.params.id);
    if (!conv) return res.status(404).json({ error: "Conversation not found" });
    const messages = config.getMessages(req.params.id);
    res.json({ ...conv, messages: messages.map(m => ({ ...m, attachments: m.attachments ? JSON.parse(m.attachments) : null })) });
  });

  router.put("/api/conversations/:id", (req, res) => {
    const conv = config.getConversation(req.params.id);
    if (!conv) return res.status(404).json({ error: "Conversation not found" });
    const updates = { ...conv };
    if (req.body.title !== undefined) updates.title = req.body.title;
    if (req.body.provider_id !== undefined) updates.provider_id = req.body.provider_id;
    if (req.body.model !== undefined) updates.model = req.body.model;
    if (req.body.system_prompt !== undefined) updates.system_prompt = req.body.system_prompt;
    if (req.body.temperature !== undefined) updates.temperature = req.body.temperature;
    if (req.body.max_tokens !== undefined) updates.max_tokens = req.body.max_tokens;
    config.saveConversation(updates);
    res.json(config.getConversation(req.params.id));
  });

  router.delete("/api/conversations/:id", (req, res) => {
    config.deleteConversation(req.params.id);
    res.json({ ok: true });
  });

  // ---- Chat (send message + get AI response with streaming) ----
  router.post("/api/conversations/:id/messages", async (req, res) => {
    const conv = config.getConversation(req.params.id);
    if (!conv) return res.status(404).json({ error: "Conversation not found" });

    const { content, attachments, skills: selectedSkills, stream, mode } = req.body;
    if (!content && (!attachments || attachments.length === 0)) {
      return res.status(400).json({ error: "content is required" });
    }

    // Build user message content with skills prepended
    let userContent = content || "";
    if (selectedSkills && selectedSkills.length > 0) {
      const allSkills = config.getAllSkills();
      const skillPrefixes = selectedSkills
        .map(sid => allSkills.find(s => s.id === sid))
        .filter(Boolean)
        .map(s => s.prompt_template);
      if (skillPrefixes.length > 0) {
        userContent = skillPrefixes.join("\n") + userContent;
      }
    }

    // Save user message
    const userMsgId = config.saveMessage({
      conversation_id: req.params.id,
      role: "user",
      content: userContent,
      attachments: attachments || null,
    });

    // Build messages array from conversation history
    const allMessages = config.getMessages(req.params.id);
    const chatMessages = allMessages.map(m => ({ role: m.role, content: m.content }));

    // Prepend system prompt based on mode
    const modePrompts = {
      plan: "You are in Plan mode. Before implementing anything, first analyze the request and create a detailed step-by-step plan. Outline your approach, list the key considerations, potential issues, and proposed solutions. Structure your response with clear headings and numbered steps. Only after presenting the plan should you ask if the user wants to proceed with implementation.",
      edit: "You are in Edit mode. Directly implement changes, write code, and provide concrete solutions. Be concise and action-oriented. Focus on producing working code and clear modifications rather than lengthy explanations.",
    };

    // Build system message: conversation system_prompt + mode prompt
    const systemParts = [];
    if (conv.system_prompt) systemParts.push(conv.system_prompt);
    if (mode && modePrompts[mode]) systemParts.push(modePrompts[mode]);
    if (systemParts.length > 0) {
      chatMessages.unshift({ role: "system", content: systemParts.join("\n\n") });
    }

    // Resolve provider
    const providerId = conv.provider_id;
    const model = conv.model;

    const typeToRegistry = {
      'cli': 'claude', 'codex-cli': 'codex', 'aider-cli': 'aider',
      'opencode-cli': 'opencode', 'openai-api': 'openai', 'ollama': 'ollama',
      'gemini-api': 'gemini', 'anthropic-api': 'openai',
    };

    let provider = null;
    if (providerId) {
      const providerConfig = config.getProvider(providerId);
      if (providerConfig) {
        provider = providerRegistry.get(providerConfig.id)
          || providerRegistry.get(providerConfig.command)
          || providerRegistry.get(typeToRegistry[providerConfig.type])
          || providerRegistry.get(providerConfig.name?.toLowerCase());
      }
    }
    if (!provider) {
      const defaultName = providerRegistry.getDefault();
      provider = providerRegistry.get(defaultName);
    }

    if (!provider) {
      return res.status(500).json({ error: "No provider available" });
    }

    // Streaming response
    if (stream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const assistantMsgId = config.saveMessage({
        conversation_id: req.params.id,
        role: "assistant",
        content: "",
      });

      let fullResponse = "";

      try {
        const emitter = provider.chatStream(chatMessages, { model, temperature: conv.temperature, max_tokens: conv.max_tokens });

        const onText = (text) => {
          fullResponse += text;
          res.write(`data: ${JSON.stringify({ type: "text", text, messageId: assistantMsgId })}\n\n`);
        };

        const onDone = () => {
          config.updateMessageContent(assistantMsgId, fullResponse);
          res.write(`data: ${JSON.stringify({ type: "done", messageId: assistantMsgId })}\n\n`);
          res.end();
        };

        const onError = (err) => {
          config.updateMessageContent(assistantMsgId, fullResponse || `Error: ${err.message}`);
          res.write(`data: ${JSON.stringify({ type: "error", error: err.message })}\n\n`);
          res.end();
        };

        if (emitter.stdout) {
          emitter.stdout.on("data", (chunk) => onText(chunk.toString()));
          emitter.on("close", onDone);
          emitter.on("error", onError);
        } else {
          emitter.on("data", onText);
          emitter.on("end", onDone);
          emitter.on("error", onError);
        }
      } catch (err) {
        config.updateMessageContent(assistantMsgId, `Error: ${err.message}`);
        res.write(`data: ${JSON.stringify({ type: "error", error: err.message })}\n\n`);
        res.end();
      }
      return;
    }

    // Non-streaming response
    try {
      const result = await provider.chat(chatMessages, { model, temperature: conv.temperature, max_tokens: conv.max_tokens });
      const assistantContent = result?.choices?.[0]?.message?.content
        || result?.content?.[0]?.text
        || (typeof result === "string" ? result : JSON.stringify(result));

      const assistantMsgId = config.saveMessage({
        conversation_id: req.params.id,
        role: "assistant",
        content: assistantContent,
      });

      res.json({
        userMessage: { id: userMsgId, role: "user", content: userContent },
        assistantMessage: { id: assistantMsgId, role: "assistant", content: assistantContent },
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---- Skills ----
  router.get("/api/skills", (req, res) => {
    res.json(config.getAllSkills());
  });

  router.post("/api/skills", (req, res) => {
    try {
      const id = config.saveSkill(req.body);
      res.status(201).json(config.getSkill(id));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.put("/api/skills/:id", (req, res) => {
    if (!config.getSkill(req.params.id)) return res.status(404).json({ error: "Skill not found" });
    config.saveSkill({ ...req.body, id: req.params.id });
    res.json(config.getSkill(req.params.id));
  });

  router.delete("/api/skills/:id", (req, res) => {
    config.deleteSkill(req.params.id);
    res.json({ ok: true });
  });

  // ---- File Upload ----
  router.post("/api/upload", (req, res) => {
    // Handled by multer middleware mounted in server.js
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    res.json({
      id: req.file.filename,
      name: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      url: `/uploads/${req.file.filename}`,
    });
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
