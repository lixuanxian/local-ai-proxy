const { Router } = require("express");
const config = require("../../lib/config");
const bcrypt = require("bcryptjs");
const { requireAuth, parseCookies } = require("../../lib/auth");
const { queryLogs, getStats, getHourlyStats, getProviderStats, getModelStats, clearLogs } = require("../../lib/logger");
const { buildContextWindow, compressConversation } = require("../../lib/context");
const { resolveProvider, buildMessageContent, logMessageAttachments } = require("../../lib/utils");

module.exports = function createManagementRouter(providerRegistry) {
  const router = Router();

  // ---- Auth (public endpoints — no auth required) ----

  router.get("/api/auth/status", (req, res) => {
    const authEnabled = config.getSetting("auth_enabled");
    const hasUsers = config.getUserCount() > 0;
    res.json({ authEnabled: authEnabled === "true", hasUsers });
  });

  router.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password are required" });

    const user = config.getUserByUsername(username);
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = config.createSession(user.id);
    res.setHeader("Set-Cookie", `session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800`);
    res.json({ user: { id: user.id, username: user.username, role: user.role } });
  });

  router.post("/api/auth/logout", (req, res) => {
    const cookies = parseCookies(req.headers.cookie || "");
    if (cookies.session) config.deleteSession(cookies.session);
    res.setHeader("Set-Cookie", "session=; HttpOnly; Path=/; Max-Age=0");
    res.json({ ok: true });
  });

  router.get("/api/auth/me", (req, res) => {
    const authEnabled = config.getSetting("auth_enabled");
    if (!authEnabled || authEnabled === "false") {
      return res.json({ user: null, authEnabled: false });
    }

    const cookies = parseCookies(req.headers.cookie || "");
    const sessionToken = cookies.session;
    if (!sessionToken) return res.status(401).json({ error: "Not authenticated" });

    const session = config.getSessionByToken(sessionToken);
    if (!session) return res.status(401).json({ error: "Invalid or expired session" });

    res.json({ user: { id: session.user_id, username: session.username, role: session.role }, authEnabled: true });
  });

  // First-time setup: create initial admin user (only works when no users exist)
  router.post("/api/auth/setup", (req, res) => {
    if (config.getUserCount() > 0) {
      return res.status(403).json({ error: "Setup already completed" });
    }
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password are required" });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

    const id = config.saveUser({ username, password, role: "admin" });
    const token = config.createSession(id);
    res.setHeader("Set-Cookie", `session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800`);
    res.json({ user: { id, username, role: "admin" } });
  });

  // ---- System Info (public — no auth for health/info) ----
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

  // ---- Auth middleware — protects all subsequent /api/* routes ----
  router.use("/api", (req, res, next) => {
    // Skip auth for public endpoints already handled above
    if (req.path.startsWith("/auth/")) return next();
    if (req.path === "/info" || req.path === "/health") return next();
    requireAuth(req, res, next);
  });

  // ---- Users (protected) ----
  router.get("/api/users", (req, res) => {
    res.json(config.getAllUsers());
  });

  router.post("/api/users", (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password are required" });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
    try {
      const id = config.saveUser({ username, password, role: role || "admin" });
      res.status(201).json(config.getUser(id));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.put("/api/users/:id", (req, res) => {
    const user = config.getUser(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    try {
      config.updateUser(req.params.id, req.body);
      res.json(config.getUser(req.params.id));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.put("/api/users/:id/password", (req, res) => {
    const user = config.getUser(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    const { password } = req.body;
    if (!password || password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
    config.changePassword(req.params.id, password);
    config.deleteUserSessions(req.params.id);
    res.json({ ok: true });
  });

  router.delete("/api/users/:id", (req, res) => {
    try {
      config.deleteUser(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
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
    // Keep existing api_key if not provided or masked
    if (!req.body.api_key || req.body.api_key === "***") req.body.api_key = existing.api_key;
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
    // Sync runtime registry
    const { idToName } = require("../../lib/provider-registry");
    const registryName = idToName[req.params.id] || req.params.id;
    if (providerRegistry.get(registryName)) {
      providerRegistry.setDefault(registryName);
    }
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

    const provider = resolveProvider(providerConfig, providerRegistry);
    if (!provider) {
      console.log(`[TEST] Provider not found in registry for id=${providerConfig.id}, type=${providerConfig.type}, registry keys: [${providerRegistry.listNames().join(', ')}]`);
      return res.json({ ok: false, error: "Provider not loaded in registry" });
    }

    const providerName = provider.name || providerConfig.id;
    const model = providerConfig.default_model || null;
    const command = provider.command || providerConfig.command || null;
    console.log(`[TEST] Testing provider=${providerName}, command=${command}, model=${model}, type=${providerConfig.type}`);
    const start = Date.now();
    const TIMEOUT_MS = 60000;
    const testMsg = [{ role: "user", content: "Hi" }];
    const raceWithTimeout = (promise) => Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(`Test timed out after ${TIMEOUT_MS / 1000}s`)), TIMEOUT_MS)),
    ]);
    try {
      const result = await raceWithTimeout(provider.chat(testMsg, { model }));
      const latency = Date.now() - start;
      const preview = result?.choices?.[0]?.message?.content?.slice(0, 100) || '';
      console.log(`[TEST] Provider ${providerName} OK (${latency}ms) response: ${preview}`);
      res.json({ ok: true, latency_ms: latency, model: model || '(default)' });
    } catch (err) {
      // For CLI providers, retry without model — model name might be invalid
      if (model && provider.command) {
        console.log(`[TEST] Retrying ${providerName} without --model (model "${model}" may be invalid)...`);
        try {
          const result = await raceWithTimeout(provider.chat(testMsg, {}));
          const latency = Date.now() - start;
          const preview = result?.choices?.[0]?.message?.content?.slice(0, 100) || '';
          console.log(`[TEST] Provider ${providerName} OK without model (${latency}ms) response: ${preview}`);
          res.json({ ok: true, latency_ms: latency, warning: `Model "${model}" may be invalid — test passed without --model flag` });
        } catch (err2) {
          const latency = Date.now() - start;
          console.log(`[TEST] Provider ${providerName} FAILED (${latency}ms): ${err2.message}`);
          res.json({ ok: false, error: err2.message, latency_ms: latency });
        }
      } else {
        const latency = Date.now() - start;
        console.log(`[TEST] Provider ${providerName} FAILED (${latency}ms): ${err.message}`);
        res.json({ ok: false, error: err.message, latency_ms: latency });
      }
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
  router.get("/api/apps/all", (req, res) => {
    res.json(config.getAllAppsUnified());
  });

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

  // ---- CORS Origins ----
  router.get("/api/cors", (req, res) => {
    res.json(config.getAllCorsOrigins());
  });

  router.get("/api/cors/pending", (req, res) => {
    res.json(config.getPendingCorsOrigins());
  });

  router.put("/api/cors/:id", (req, res) => {
    const { status } = req.body;
    if (!status || !["approved", "rejected", "pending"].includes(status)) {
      return res.status(400).json({ error: "status must be approved, rejected, or pending" });
    }
    config.updateCorsOriginStatus(req.params.id, status);
    res.json({ ok: true });
  });

  router.delete("/api/cors/:id", (req, res) => {
    config.deleteCorsOrigin(req.params.id);
    res.json({ ok: true });
  });

  // Shared helper: fetch website metadata from a URL
  async function fetchSiteMeta(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LocalAIProxy/1.0)" },
    });
    clearTimeout(timeout);
    const html = await response.text();
    const meta = {};
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) meta.title = titleMatch[1].trim();
    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    if (descMatch) meta.description = descMatch[1].trim();
    const iconMatch = html.match(/<link[^>]+rel=["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]+href=["']([^"']+)["']/i)
      || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:icon|shortcut icon|apple-touch-icon)["']/i);
    if (iconMatch) {
      let iconUrl = iconMatch[1];
      const base = new URL(url).origin;
      if (iconUrl.startsWith("//")) iconUrl = "https:" + iconUrl;
      else if (iconUrl.startsWith("/")) iconUrl = base + iconUrl;
      else if (!iconUrl.startsWith("http")) iconUrl = base + "/" + iconUrl;
      meta.icon = iconUrl;
    } else {
      meta.icon = new URL(url).origin + "/favicon.ico";
    }
    if (meta.title) meta.name = meta.title;
    return meta;
  }

  // Fetch website metadata for a CORS origin
  router.post("/api/cors/:id/fetch-meta", async (req, res) => {
    const record = config.getAllCorsOrigins().find(c => c.id === req.params.id);
    if (!record) return res.status(404).json({ error: "Origin not found" });
    try {
      const meta = await fetchSiteMeta(record.origin);
      config.updateCorsOriginMeta(req.params.id, meta);
      res.json(meta);
    } catch (err) {
      res.json({ error: err.message });
    }
  });

  // Fetch website metadata for a user app
  router.post("/api/apps/:id/fetch-meta", async (req, res) => {
    const app = config.getApp(req.params.id);
    if (!app) return res.status(404).json({ error: "App not found" });
    try {
      const meta = await fetchSiteMeta(app.url);
      // Update the app with fetched info
      const updates = {};
      if (meta.title) updates.name = meta.title;
      if (meta.icon) updates.icon = meta.icon;
      if (meta.description) updates.description = meta.description;
      config.saveApp({ ...app, ...updates });
      res.json(meta);
    } catch (err) {
      res.json({ error: err.message });
    }
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
    const limit = parseInt(req.query.limit) || 10;
    const before = req.query.before || null;
    const total = config.getMessageCount(req.params.id);
    const messages = config.getMessagesPaginated(req.params.id, { limit, before });
    let contextInfo = null;
    try { contextInfo = buildContextWindow(req.params.id, {}).contextInfo; } catch { /* ignore */ }
    res.json({
      ...conv,
      messages: messages.map(m => ({ ...m, attachments: m.attachments ? JSON.parse(m.attachments) : null })),
      total_messages: total,
      contextInfo,
    });
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
    if (req.body.context_limit !== undefined) updates.context_limit = req.body.context_limit;
    if (req.body.auto_compress !== undefined) updates.auto_compress = req.body.auto_compress;
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

    // Resolve provider first (needed for potential auto-compress)
    const providerId = conv.provider_id;
    const model = conv.model;

    let provider = null;
    let resolvedName = null;
    if (providerId) {
      const providerConfig = config.getProvider(providerId);
      if (providerConfig) {
        resolvedName = providerConfig.id;
        provider = resolveProvider(providerConfig, providerRegistry);
      }
    }
    if (!provider) {
      resolvedName = providerRegistry.getDefault();
      provider = providerRegistry.get(resolvedName);
    }

    if (!provider) {
      console.log(`[CHAT] No provider available, registry keys: [${providerRegistry.listNames().join(', ')}]`);
      return res.status(500).json({ error: "No provider available" });
    }

    // Build context window (respects context_limit, includes summary if available)
    let contextResult = buildContextWindow(req.params.id, {
      systemPrompt: conv.system_prompt,
      mode,
    });

    // Auto-compress if recommended and enabled
    if (contextResult.contextInfo.compressRecommended && conv.auto_compress) {
      try {
        await compressConversation(req.params.id, provider, model);
        contextResult = buildContextWindow(req.params.id, {
          systemPrompt: conv.system_prompt,
          mode,
        });
        console.log(`[CHAT] Auto-compressed conv=${req.params.id}`);
      } catch (compressErr) {
        console.error(`[CHAT] Auto-compress failed for conv=${req.params.id}: ${compressErr.message}`);
      }
    }

    // Apply multimodal content building (images, files) to context messages
    const chatMessages = contextResult.messages.map(m => ({
      role: m.role,
      content: m.attachments ? buildMessageContent(m.content, m.attachments) : m.content,
    }));
    const contextInfo = contextResult.contextInfo;

    console.log(`[CHAT] conv=${req.params.id}, provider=${resolvedName}, model=${model}, messages=${chatMessages.length}/${contextInfo.totalMessages}, tokens=~${contextInfo.estimatedTokens}, stream=${!!stream}`);
    logMessageAttachments("CHAT", chatMessages);

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
          config.updateMessageTokenEstimate(assistantMsgId, Math.ceil(fullResponse.length / 4));
          // Rebuild context info after response is saved
          const updatedCtx = buildContextWindow(req.params.id, {}).contextInfo;
          res.write(`data: ${JSON.stringify({ type: "done", messageId: assistantMsgId, contextInfo: updatedCtx })}\n\n`);
          res.end();
        };

        const onError = (err) => {
          console.error(`[CHAT] Stream error for conv=${req.params.id}: ${err.message}`);
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
        console.error(`[CHAT] Stream setup error for conv=${req.params.id}: ${err.message}`);
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

      const updatedCtx = buildContextWindow(req.params.id, {}).contextInfo;
      res.json({
        userMessage: { id: userMsgId, role: "user", content: userContent },
        assistantMessage: { id: assistantMsgId, role: "assistant", content: assistantContent },
        contextInfo: updatedCtx,
      });
    } catch (err) {
      console.error(`[CHAT] Non-stream error for conv=${req.params.id}: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  // ---- Context / Compression ----
  router.get("/api/conversations/:id/context", (req, res) => {
    const conv = config.getConversation(req.params.id);
    if (!conv) return res.status(404).json({ error: "Conversation not found" });
    try {
      const { contextInfo } = buildContextWindow(req.params.id, {});
      res.json(contextInfo);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/api/conversations/:id/compress", async (req, res) => {
    const conv = config.getConversation(req.params.id);
    if (!conv) return res.status(404).json({ error: "Conversation not found" });

    // Resolve provider
    let provider = null;
    if (conv.provider_id) {
      const providerConfig = config.getProvider(conv.provider_id);
      if (providerConfig) provider = resolveProvider(providerConfig, providerRegistry);
    }
    if (!provider) {
      const defaultName = providerRegistry.getDefault();
      provider = providerRegistry.get(defaultName);
    }
    if (!provider) return res.status(500).json({ error: "No provider available for compression" });

    try {
      const result = await compressConversation(req.params.id, provider, conv.model);
      res.json(result);
    } catch (err) {
      console.error(`[COMPRESS] Error for conv=${req.params.id}: ${err.message}`);
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

  // Import skill(s) from URL - proxied to avoid CORS
  router.post("/api/skills/import", async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "url is required" });
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!resp.ok) return res.status(400).json({ error: `Failed to fetch: ${resp.status} ${resp.statusText}` });
      const contentType = resp.headers.get("content-type") || "";
      if (!contentType.includes("json")) return res.status(400).json({ error: "URL must return JSON" });
      const data = await resp.json();
      const skills = Array.isArray(data) ? data : data.skills ? data.skills : [data];
      const imported = [];
      for (const s of skills) {
        if (!s.name || !s.prompt_template) continue;
        const id = config.saveSkill({ name: s.name, description: s.description || "", prompt_template: s.prompt_template, enabled: true });
        imported.push(config.getSkill(id));
      }
      if (imported.length === 0) return res.status(400).json({ error: "No valid skills found in response (need name + prompt_template)" });
      res.json({ imported });
    } catch (err) {
      res.status(400).json({ error: err.message || "Import failed" });
    }
  });

  // ---- API Tokens ----
  router.get("/api/tokens", (req, res) => {
    const tokens = config.getAllApiTokens();
    // Mask token values — show only last 8 chars
    res.json(tokens.map(t => ({
      ...t,
      token: t.token.length > 8 ? "***" + t.token.slice(-8) : "***",
    })));
  });

  router.post("/api/tokens", (req, res) => {
    const { name, expires_at } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });
    const crypto = require("crypto");
    const token = "lap_" + crypto.randomBytes(24).toString("hex");
    const id = config.saveApiToken({ name, token, enabled: true, expires_at: expires_at || null });
    // Return full token only on creation
    res.status(201).json(config.getApiToken(id));
  });

  router.put("/api/tokens/:id", (req, res) => {
    const existing = config.getApiToken(req.params.id);
    if (!existing) return res.status(404).json({ error: "Token not found" });
    if (req.body.name !== undefined || req.body.expires_at !== undefined) {
      config.saveApiToken({
        ...existing,
        name: req.body.name !== undefined ? req.body.name : existing.name,
        expires_at: req.body.expires_at !== undefined ? req.body.expires_at : existing.expires_at,
      });
    }
    if (req.body.enabled !== undefined) {
      config.updateApiTokenEnabled(req.params.id, req.body.enabled);
    }
    const updated = config.getApiToken(req.params.id);
    res.json({ ...updated, token: updated.token.length > 8 ? "***" + updated.token.slice(-8) : "***" });
  });

  router.delete("/api/tokens/:id", (req, res) => {
    config.deleteApiToken(req.params.id);
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

  return router;
};
