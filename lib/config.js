const db = require("./db");
const crypto = require("crypto");

// ---- Settings ----

const stmtGetSetting = db.prepare("SELECT value FROM settings WHERE key = ?");
const stmtSetSetting = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
const stmtAllSettings = db.prepare("SELECT key, value FROM settings");

function getSetting(key) {
  const row = stmtGetSetting.get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  stmtSetSetting.run(key, String(value));
}

function getAllSettings() {
  const rows = stmtAllSettings.all();
  const obj = {};
  for (const r of rows) obj[r.key] = r.value;
  return obj;
}

// ---- Providers ----

const stmtAllProviders = db.prepare("SELECT * FROM providers ORDER BY priority ASC, is_default DESC, name ASC");
const stmtGetProvider = db.prepare("SELECT * FROM providers WHERE id = ?");
const stmtDeleteProvider = db.prepare("DELETE FROM providers WHERE id = ?");
const stmtClearDefault = db.prepare("UPDATE providers SET is_default = 0");

function getAllProviders() {
  return stmtAllProviders.all();
}

function getProvider(id) {
  return stmtGetProvider.get(id);
}

function saveProvider(provider) {
  const id = provider.id || crypto.randomUUID();
  db.prepare(`
    INSERT OR REPLACE INTO providers (id, name, type, enabled, is_default, command, base_url, api_key, default_model, model_patterns, extra_config, priority, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    id,
    provider.name,
    provider.type,
    provider.enabled !== undefined ? (provider.enabled ? 1 : 0) : 1,
    provider.is_default ? 1 : 0,
    provider.command || null,
    provider.base_url || null,
    provider.api_key || null,
    provider.default_model || null,
    provider.model_patterns ? (typeof provider.model_patterns === "string" ? provider.model_patterns : JSON.stringify(provider.model_patterns)) : null,
    provider.extra_config ? (typeof provider.extra_config === "string" ? provider.extra_config : JSON.stringify(provider.extra_config)) : null,
    provider.priority !== undefined ? provider.priority : 0,
  );
  return id;
}

function toggleProvider(id, enabled) {
  db.prepare("UPDATE providers SET enabled = ?, updated_at = datetime('now') WHERE id = ?").run(enabled ? 1 : 0, id);
}

function updateProviderPriority(id, priority) {
  db.prepare("UPDATE providers SET priority = ?, updated_at = datetime('now') WHERE id = ?").run(priority, id);
}

function deleteProvider(id) {
  stmtDeleteProvider.run(id);
}

function setDefaultProvider(id) {
  db.transaction(() => {
    stmtClearDefault.run();
    db.prepare("UPDATE providers SET is_default = 1 WHERE id = ?").run(id);
    setSetting("default_provider_id", id);
  })();
}

function getDefaultProvider() {
  // Prefer enabled default provider; fall back to any default
  const row = db.prepare("SELECT * FROM providers WHERE is_default = 1 AND enabled = 1 LIMIT 1").get()
    || db.prepare("SELECT * FROM providers WHERE is_default = 1 LIMIT 1").get();
  return row || null;
}

function bulkToggleProviders(ids, enabled) {
  const stmt = db.prepare("UPDATE providers SET enabled = ? WHERE id = ?");
  db.transaction(() => {
    for (const id of ids) {
      stmt.run(enabled ? 1 : 0, id);
    }
  })();
}

// ---- Apps ----

const stmtAllApps = db.prepare("SELECT * FROM apps ORDER BY sort_order ASC, name ASC");
const stmtGetApp = db.prepare("SELECT * FROM apps WHERE id = ?");
const stmtDeleteApp = db.prepare("DELETE FROM apps WHERE id = ?");

function getAllApps() {
  return stmtAllApps.all();
}

function getApp(id) {
  return stmtGetApp.get(id);
}

function saveApp(app) {
  const id = app.id || crypto.randomUUID();
  db.prepare(`
    INSERT OR REPLACE INTO apps (id, name, url, icon, description, cors_origin, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, app.name, app.url, app.icon || null, app.description || null, app.cors_origin || null, app.sort_order || 0);
  return id;
}

function deleteApp(id) {
  stmtDeleteApp.run(id);
}

function reorderApps(ids) {
  const stmt = db.prepare("UPDATE apps SET sort_order = ? WHERE id = ?");
  db.transaction(() => {
    ids.forEach((id, index) => stmt.run(index, id));
  })();
}

function getAllAppsUnified() {
  const apps = stmtAllApps.all().map(a => ({
    id: a.id,
    name: a.name,
    url: a.url,
    icon: a.icon || null,
    description: a.description || null,
    status: 'approved',
    source: 'user',
    cors_origin: a.cors_origin || null,
    sort_order: a.sort_order || 0,
    first_seen: a.created_at,
    last_seen: a.created_at,
    created_at: a.created_at,
  }));
  const origins = stmtAllCorsOrigins.all().map(c => ({
    id: c.id,
    name: c.title || c.name || c.origin,
    url: c.origin,
    icon: c.icon || null,
    description: c.description || null,
    status: c.status,
    source: 'auto',
    cors_origin: c.origin,
    sort_order: 9999,
    first_seen: c.first_seen,
    last_seen: c.last_seen,
    created_at: c.first_seen,
  }));
  return [...apps, ...origins];
}

// ---- Conversations ----

const stmtAllConversations = db.prepare("SELECT * FROM conversations ORDER BY updated_at DESC");
const stmtGetConversation = db.prepare("SELECT * FROM conversations WHERE id = ?");
const stmtDeleteConversation = db.prepare("DELETE FROM conversations WHERE id = ?");
const stmtDeleteConversationMessages = db.prepare("DELETE FROM messages WHERE conversation_id = ?");

function getAllConversations(search) {
  if (search) {
    return db.prepare("SELECT * FROM conversations WHERE title LIKE ? ORDER BY updated_at DESC").all(`%${search}%`);
  }
  return stmtAllConversations.all();
}

function getConversation(id) {
  return stmtGetConversation.get(id);
}

function saveConversation(conv) {
  const id = conv.id || crypto.randomUUID();
  db.prepare(`
    INSERT OR REPLACE INTO conversations (id, title, provider_id, model, system_prompt, temperature, max_tokens, context_limit, auto_compress, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM conversations WHERE id = ?), datetime('now')), datetime('now'))
  `).run(id, conv.title || "New Chat", conv.provider_id || null, conv.model || null,
    conv.system_prompt || null, conv.temperature ?? null, conv.max_tokens ?? null,
    conv.context_limit ?? 10, conv.auto_compress !== undefined ? (conv.auto_compress ? 1 : 0) : 1, id);
  return id;
}

function updateConversationTitle(id, title) {
  db.prepare("UPDATE conversations SET title = ?, updated_at = datetime('now') WHERE id = ?").run(title, id);
}

function touchConversation(id) {
  db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(id);
}

function deleteConversation(id) {
  db.transaction(() => {
    stmtDeleteConversationMessages.run(id);
    stmtDeleteConversation.run(id);
  })();
}

// ---- Messages ----

function getMessages(conversationId) {
  return db.prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC").all(conversationId);
}

function getMessagesPaginated(conversationId, { limit = 10, before = null } = {}) {
  if (before) {
    return db.prepare(
      "SELECT * FROM messages WHERE conversation_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?"
    ).all(conversationId, before, limit).reverse();
  }
  // Get the latest N messages (subquery for DESC, then reverse)
  return db.prepare(
    "SELECT * FROM (SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?) sub ORDER BY created_at ASC"
  ).all(conversationId, limit);
}

function getMessageCount(conversationId) {
  return db.prepare("SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?").get(conversationId).count;
}

function saveMessage(msg) {
  const id = msg.id || crypto.randomUUID();
  const content = msg.content || "";
  const tokenEstimate = msg.token_estimate || Math.ceil(content.length / 4);
  db.prepare(`
    INSERT INTO messages (id, conversation_id, role, content, attachments, is_summary, token_estimate, summarizes_up_to, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(id, msg.conversation_id, msg.role, content,
    msg.attachments ? JSON.stringify(msg.attachments) : null,
    msg.is_summary ? 1 : 0, tokenEstimate, msg.summarizes_up_to || null);
  touchConversation(msg.conversation_id);
  return id;
}

function updateMessageContent(id, content) {
  db.prepare("UPDATE messages SET content = ? WHERE id = ?").run(content, id);
}

function deleteMessage(id) {
  db.prepare("DELETE FROM messages WHERE id = ?").run(id);
}

// ---- Skills ----

const stmtAllSkills = db.prepare("SELECT * FROM skills ORDER BY sort_order ASC, name ASC");
const stmtGetSkill = db.prepare("SELECT * FROM skills WHERE id = ?");

function getAllSkills() {
  return stmtAllSkills.all();
}

function getSkill(id) {
  return stmtGetSkill.get(id);
}

function saveSkill(skill) {
  const id = skill.id || crypto.randomUUID();
  db.prepare(`
    INSERT OR REPLACE INTO skills (id, name, description, prompt_template, enabled, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, skill.name, skill.description || null, skill.prompt_template, skill.enabled !== undefined ? (skill.enabled ? 1 : 0) : 1, skill.sort_order || 0);
  return id;
}

function deleteSkill(id) {
  db.prepare("DELETE FROM skills WHERE id = ?").run(id);
}

// ---- Context / Summary helpers ----

function getLatestSummary(conversationId) {
  return db.prepare(
    "SELECT * FROM messages WHERE conversation_id = ? AND is_summary = 1 ORDER BY created_at DESC LIMIT 1"
  ).get(conversationId) || null;
}

function getMessagesAfterSummary(conversationId, summaryCreatedAt) {
  return db.prepare(
    "SELECT * FROM messages WHERE conversation_id = ? AND is_summary = 0 AND created_at > ? ORDER BY created_at ASC"
  ).all(conversationId, summaryCreatedAt);
}

function getNonSummaryMessages(conversationId) {
  return db.prepare(
    "SELECT * FROM messages WHERE conversation_id = ? AND is_summary = 0 ORDER BY created_at ASC"
  ).all(conversationId);
}

function deleteSummaries(conversationId) {
  db.prepare("DELETE FROM messages WHERE conversation_id = ? AND is_summary = 1").run(conversationId);
}

function updateMessageTokenEstimate(id, tokenEstimate) {
  db.prepare("UPDATE messages SET token_estimate = ? WHERE id = ?").run(tokenEstimate, id);
}

// ---- CORS Origins ----

const stmtAllCorsOrigins = db.prepare("SELECT * FROM cors_origins ORDER BY last_seen DESC");
const stmtGetCorsOrigin = db.prepare("SELECT * FROM cors_origins WHERE id = ?");
const stmtGetCorsOriginByOrigin = db.prepare("SELECT * FROM cors_origins WHERE origin = ?");
const stmtPendingCorsOrigins = db.prepare("SELECT * FROM cors_origins WHERE status = 'pending' ORDER BY last_seen DESC");
const stmtDeleteCorsOrigin = db.prepare("DELETE FROM cors_origins WHERE id = ?");

function getAllCorsOrigins() {
  return stmtAllCorsOrigins.all();
}

function getCorsOriginByOrigin(origin) {
  return stmtGetCorsOriginByOrigin.get(origin) || null;
}

function upsertCorsOrigin(origin, status) {
  const existing = stmtGetCorsOriginByOrigin.get(origin);
  if (existing) {
    db.prepare("UPDATE cors_origins SET last_seen = datetime('now') WHERE id = ?").run(existing.id);
    return existing;
  }
  const id = crypto.randomUUID();
  // Extract a readable name from the origin
  let name = origin;
  try { name = new URL(origin).hostname; } catch { /* keep raw */ }
  db.prepare(
    "INSERT INTO cors_origins (id, origin, name, status) VALUES (?, ?, ?, ?)"
  ).run(id, origin, name, status || "pending");
  return stmtGetCorsOrigin.get(id);
}

function updateCorsOriginStatus(id, status) {
  db.prepare("UPDATE cors_origins SET status = ? WHERE id = ?").run(status, id);
}

function updateCorsOriginMeta(id, { title, icon, description, name }) {
  const fields = [];
  const values = [];
  if (title !== undefined) { fields.push("title = ?"); values.push(title); }
  if (icon !== undefined) { fields.push("icon = ?"); values.push(icon); }
  if (description !== undefined) { fields.push("description = ?"); values.push(description); }
  if (name !== undefined) { fields.push("name = ?"); values.push(name); }
  if (fields.length === 0) return;
  values.push(id);
  db.prepare(`UPDATE cors_origins SET ${fields.join(", ")} WHERE id = ?`).run(...values);
}

function deleteCorsOrigin(id) {
  stmtDeleteCorsOrigin.run(id);
}

function getPendingCorsOrigins() {
  return stmtPendingCorsOrigins.all();
}

// ---- API Tokens ----

const stmtAllApiTokens = db.prepare("SELECT * FROM api_tokens ORDER BY created_at ASC");
const stmtGetApiToken = db.prepare("SELECT * FROM api_tokens WHERE id = ?");
const stmtGetApiTokenByToken = db.prepare("SELECT * FROM api_tokens WHERE token = ? AND enabled = 1 AND (expires_at IS NULL OR expires_at > datetime('now'))");
const stmtDeleteApiToken = db.prepare("DELETE FROM api_tokens WHERE id = ?");
const stmtUpdateApiTokenLastUsed = db.prepare("UPDATE api_tokens SET last_used_at = datetime('now') WHERE id = ?");

function getAllApiTokens() {
  return stmtAllApiTokens.all();
}

function getApiToken(id) {
  return stmtGetApiToken.get(id);
}

function getApiTokenByToken(token) {
  return stmtGetApiTokenByToken.get(token) || null;
}

function saveApiToken(tok) {
  const id = tok.id || crypto.randomUUID();
  db.prepare(`
    INSERT OR REPLACE INTO api_tokens (id, name, token, enabled, created_at, last_used_at, expires_at)
    VALUES (?, ?, ?, ?, COALESCE((SELECT created_at FROM api_tokens WHERE id = ?), datetime('now')), (SELECT last_used_at FROM api_tokens WHERE id = ?), ?)
  `).run(id, tok.name, tok.token, tok.enabled !== undefined ? (tok.enabled ? 1 : 0) : 1, id, id, tok.expires_at || null);
  return id;
}

function updateApiTokenEnabled(id, enabled) {
  db.prepare("UPDATE api_tokens SET enabled = ? WHERE id = ?").run(enabled ? 1 : 0, id);
}

function updateApiTokenLastUsed(id) {
  stmtUpdateApiTokenLastUsed.run(id);
}

function deleteApiToken(id) {
  stmtDeleteApiToken.run(id);
}

// ---- Users ----

const bcrypt = require("bcryptjs");

const stmtAllUsers = db.prepare("SELECT id, username, role, created_at, updated_at FROM users ORDER BY created_at ASC");
const stmtGetUser = db.prepare("SELECT id, username, role, created_at, updated_at FROM users WHERE id = ?");
const stmtGetUserByUsername = db.prepare("SELECT * FROM users WHERE username = ?");
const stmtDeleteUser = db.prepare("DELETE FROM users WHERE id = ?");
const stmtUserCount = db.prepare("SELECT COUNT(*) as c FROM users");

function getAllUsers() {
  return stmtAllUsers.all();
}

function getUser(id) {
  return stmtGetUser.get(id) || null;
}

function getUserByUsername(username) {
  return stmtGetUserByUsername.get(username) || null;
}

function saveUser(user) {
  const id = user.id || crypto.randomUUID();
  const hash = bcrypt.hashSync(user.password, 10);
  db.prepare(`
    INSERT OR REPLACE INTO users (id, username, password, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, COALESCE((SELECT created_at FROM users WHERE id = ?), datetime('now')), datetime('now'))
  `).run(id, user.username, hash, user.role || "admin", id);
  return id;
}

function updateUser(id, data) {
  const fields = [];
  const values = [];
  if (data.username !== undefined) { fields.push("username = ?"); values.push(data.username); }
  if (data.role !== undefined) { fields.push("role = ?"); values.push(data.role); }
  if (fields.length === 0) return;
  fields.push("updated_at = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`).run(...values);
}

function changePassword(id, newPassword) {
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare("UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?").run(hash, id);
}

function deleteUser(id) {
  // Prevent deleting last admin
  const user = stmtGetUser.get(id);
  if (user && user.role === "admin") {
    const adminCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'admin'").get();
    if (adminCount.c <= 1) throw new Error("Cannot delete the last admin user");
  }
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
  stmtDeleteUser.run(id);
}

function getUserCount() {
  return stmtUserCount.get().c;
}

// ---- Sessions ----

const stmtDeleteExpiredSessions = db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')");
const stmtDeleteSession = db.prepare("DELETE FROM sessions WHERE id = ?");
const stmtDeleteUserSessions = db.prepare("DELETE FROM sessions WHERE user_id = ?");

function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().replace("T", " ").replace("Z", "");
  db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").run(token, userId, expiresAt);
  return token;
}

function getSessionByToken(token) {
  return db.prepare(
    "SELECT s.id, s.user_id, s.expires_at, u.username, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = ? AND s.expires_at > datetime('now')"
  ).get(token) || null;
}

function deleteSession(token) {
  stmtDeleteSession.run(token);
}

function deleteExpiredSessions() {
  stmtDeleteExpiredSessions.run();
}

function deleteUserSessions(userId) {
  stmtDeleteUserSessions.run(userId);
}

// ---- MCP Servers ----

const stmtAllMcpServers = db.prepare("SELECT * FROM mcp_servers ORDER BY sort_order ASC, name ASC");
const stmtGetMcpServer = db.prepare("SELECT * FROM mcp_servers WHERE id = ?");
const stmtDeleteMcpServer = db.prepare("DELETE FROM mcp_servers WHERE id = ?");

function getAllMcpServers() {
  return stmtAllMcpServers.all();
}

function getMcpServer(id) {
  return stmtGetMcpServer.get(id) || null;
}

function saveMcpServer(data) {
  const id = data.id || crypto.randomUUID();
  db.prepare(`
    INSERT OR REPLACE INTO mcp_servers (id, name, url, transport_type, headers, enabled, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM mcp_servers WHERE id = ?), datetime('now')), datetime('now'))
  `).run(
    id, data.name, data.url,
    data.transport_type || 'streamable-http',
    data.headers ? (typeof data.headers === 'string' ? data.headers : JSON.stringify(data.headers)) : null,
    data.enabled !== undefined ? (data.enabled ? 1 : 0) : 1,
    data.sort_order || 0, id
  );
  return id;
}

function deleteMcpServer(id) {
  stmtDeleteMcpServer.run(id);
}

function toggleMcpServer(id, enabled) {
  db.prepare("UPDATE mcp_servers SET enabled = ?, updated_at = datetime('now') WHERE id = ?").run(enabled ? 1 : 0, id);
}

// ---- Model Mappings ----

function getAllModelMappings() {
  return db.prepare(`
    SELECT mm.*, p.name as provider_name, p.enabled as provider_enabled, p.type as provider_type
    FROM model_mappings mm
    JOIN providers p ON mm.provider_id = p.id
    ORDER BY mm.model_name ASC,
      CASE WHEN mm.source = 'manual' THEN 0 ELSE 1 END,
      mm.priority ASC,
      p.priority ASC
  `).all();
}

function getModelMappingsForProvider(providerId) {
  return db.prepare("SELECT * FROM model_mappings WHERE provider_id = ? ORDER BY model_name ASC").all(providerId);
}

function getModelMappingsByModel(modelName) {
  return db.prepare(`
    SELECT mm.*, p.name as provider_name, p.enabled as provider_enabled, p.priority as provider_priority
    FROM model_mappings mm
    JOIN providers p ON mm.provider_id = p.id
    WHERE mm.model_name = ?
    ORDER BY
      CASE WHEN mm.source = 'manual' THEN 0 ELSE 1 END,
      mm.priority ASC,
      p.priority ASC
  `).all(modelName);
}

function saveModelMapping(mapping) {
  const id = mapping.id || crypto.randomUUID();
  db.prepare(`
    INSERT OR REPLACE INTO model_mappings (id, model_name, provider_id, priority, source, created_at)
    VALUES (?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM model_mappings WHERE id = ?), datetime('now')))
  `).run(id, mapping.model_name, mapping.provider_id, mapping.priority ?? 0, mapping.source || 'manual', id);
  return id;
}

function deleteModelMapping(id) {
  db.prepare("DELETE FROM model_mappings WHERE id = ?").run(id);
}

function deleteModelMappingsBulk(ids) {
  if (!ids.length) return 0;
  const placeholders = ids.map(() => '?').join(',');
  return db.prepare(`DELETE FROM model_mappings WHERE id IN (${placeholders})`).run(...ids).changes;
}

function deleteModelMappingsForProvider(providerId) {
  db.prepare("DELETE FROM model_mappings WHERE provider_id = ?").run(providerId);
}

function bulkSaveModelMappings(mappings) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO model_mappings (id, model_name, provider_id, priority, source)
    VALUES (?, ?, ?, ?, ?)
  `);
  db.transaction(() => {
    for (const m of mappings) {
      stmt.run(crypto.randomUUID(), m.model_name, m.provider_id, m.priority ?? 0, m.source || 'auto');
    }
  })();
}

function updateModelMapping(id, data) {
  const fields = [];
  const values = [];
  if (data.model_name !== undefined) { fields.push('model_name = ?'); values.push(data.model_name); }
  if (data.provider_id !== undefined) { fields.push('provider_id = ?'); values.push(data.provider_id); }
  if (data.priority !== undefined) { fields.push('priority = ?'); values.push(data.priority); }
  if (fields.length === 0) return;
  values.push(id);
  db.prepare(`UPDATE model_mappings SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

function updateModelMappingPriority(id, priority) {
  db.prepare("UPDATE model_mappings SET priority = ? WHERE id = ?").run(priority, id);
}

function getDistinctModels() {
  return db.prepare(`
    SELECT mm.model_name, COUNT(DISTINCT mm.provider_id) as provider_count
    FROM model_mappings mm
    JOIN providers p ON mm.provider_id = p.id
    GROUP BY mm.model_name
    ORDER BY mm.model_name ASC
  `).all();
}

function resolveModelProvider(modelName) {
  // Find best provider for a model: manual mappings first, then auto, respecting provider priority
  // Resolution order: manual source (user-set priority) > auto source (provider priority) > pattern matching
  const mapping = db.prepare(`
    SELECT mm.provider_id, mm.source, p.enabled
    FROM model_mappings mm
    JOIN providers p ON mm.provider_id = p.id
    WHERE mm.model_name = ? AND p.enabled = 1
    ORDER BY
      CASE WHEN mm.source = 'manual' THEN 0 ELSE 1 END,
      mm.priority ASC,
      p.priority ASC
    LIMIT 1
  `).get(modelName);
  return mapping || null;
}

module.exports = {
  getSetting, setSetting, getAllSettings,
  getAllProviders, getProvider, saveProvider, deleteProvider, setDefaultProvider, getDefaultProvider, bulkToggleProviders, toggleProvider, updateProviderPriority,
  getAllApps, getApp, saveApp, deleteApp, reorderApps, getAllAppsUnified,
  getAllConversations, getConversation, saveConversation, updateConversationTitle, deleteConversation,
  getMessages, getMessagesPaginated, getMessageCount, saveMessage, updateMessageContent, deleteMessage,
  getLatestSummary, getMessagesAfterSummary, getNonSummaryMessages, deleteSummaries, updateMessageTokenEstimate,
  getAllSkills, getSkill, saveSkill, deleteSkill,
  getAllCorsOrigins, getCorsOriginByOrigin, upsertCorsOrigin, updateCorsOriginStatus, updateCorsOriginMeta, deleteCorsOrigin, getPendingCorsOrigins,
  getAllApiTokens, getApiToken, getApiTokenByToken, saveApiToken, updateApiTokenEnabled, updateApiTokenLastUsed, deleteApiToken,
  getAllUsers, getUser, getUserByUsername, saveUser, updateUser, changePassword, deleteUser, getUserCount,
  createSession, getSessionByToken, deleteSession, deleteExpiredSessions, deleteUserSessions,
  getAllModelMappings, getModelMappingsForProvider, getModelMappingsByModel, saveModelMapping,
  deleteModelMapping, deleteModelMappingsBulk, deleteModelMappingsForProvider, bulkSaveModelMappings, updateModelMapping, updateModelMappingPriority,
  getDistinctModels, resolveModelProvider,
  getAllMcpServers, getMcpServer, saveMcpServer, deleteMcpServer, toggleMcpServer,
};
