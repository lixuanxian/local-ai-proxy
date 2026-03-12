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

const stmtAllProviders = db.prepare("SELECT * FROM providers ORDER BY is_default DESC, name ASC");
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
    INSERT OR REPLACE INTO providers (id, name, type, enabled, is_default, command, base_url, api_key, default_model, model_patterns, extra_config, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
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
  );
  return id;
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
  const row = db.prepare("SELECT * FROM providers WHERE is_default = 1 LIMIT 1").get();
  return row || null;
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

// ---- Docker Configs ----

const stmtAllDocker = db.prepare("SELECT * FROM docker_configs ORDER BY name ASC");
const stmtGetDocker = db.prepare("SELECT * FROM docker_configs WHERE id = ?");
const stmtDeleteDocker = db.prepare("DELETE FROM docker_configs WHERE id = ?");

function getAllDockerConfigs() {
  return stmtAllDocker.all();
}

function getDockerConfig(id) {
  return stmtGetDocker.get(id);
}

function saveDockerConfig(config) {
  const id = config.id || crypto.randomUUID();
  db.prepare(`
    INSERT OR REPLACE INTO docker_configs (id, name, image, cpu_limit, memory_limit, timeout_seconds, enabled, network, workspace_path, env_vars, sandbox_mode, extra_config)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, config.name, config.image, config.cpu_limit || "1", config.memory_limit || "512m",
    config.timeout_seconds || 300, config.enabled ? 1 : 0,
    config.network || "none", config.workspace_path || null,
    config.env_vars || null, config.sandbox_mode ? 1 : 0,
    config.extra_config || null);
  return id;
}

function getEnabledSandboxConfig() {
  return db.prepare("SELECT * FROM docker_configs WHERE enabled = 1 AND sandbox_mode = 1 LIMIT 1").get() || null;
}

function deleteDockerConfig(id) {
  stmtDeleteDocker.run(id);
}

module.exports = {
  getSetting, setSetting, getAllSettings,
  getAllProviders, getProvider, saveProvider, deleteProvider, setDefaultProvider, getDefaultProvider,
  getAllApps, getApp, saveApp, deleteApp, reorderApps,
  getAllDockerConfigs, getDockerConfig, saveDockerConfig, deleteDockerConfig, getEnabledSandboxConfig,
};
