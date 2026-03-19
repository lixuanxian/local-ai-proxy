'use strict';
/**
 * config-loader.js — reads config.json next to the executable (or project root in dev)
 * and applies the settings to the database on startup.
 *
 * config.json schema:
 * {
 *   "port": 3199,
 *   "providers": [
 *     { "name": "My Ollama", "type": "openai-api", "base_url": "...", "api_key": "",
 *       "default_model": "llama3.2", "enabled": true, "is_default": false }
 *   ],
 *   "users": [
 *     { "username": "admin", "password": "changeme", "role": "admin" }
 *   ],
 *   "settings": {
 *     "auth_enabled": "false",
 *     "cors_mode": "allow_all",
 *     "logging_enabled": "true"
 *   }
 * }
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getWritableBase } = require('./paths');

const CONFIG_PATH = path.join(getWritableBase(), 'config.json');

/** Read and parse config.json. Returns null if not found or invalid. */
function loadConfigFile() {
  if (!fs.existsSync(CONFIG_PATH)) return null;
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[config.json] Parse error: ${err.message}`);
    return null;
  }
}

/**
 * Create a template config.json if one doesn't exist.
 * The template includes docs comments and sensible defaults.
 */
function createDefaultConfigFile() {
  if (fs.existsSync(CONFIG_PATH)) return;

  const template = {
    _readme: [
      "Local AI Proxy config file. Edit and restart the server to apply changes.",
      "providers: created on startup if a provider with that name doesn't already exist.",
      "users:     created on startup if the username doesn't already exist.",
      "settings:  applied every startup (overwrite DB settings).",
      "port:      set process.env.PORT before the server binds (overrides PORT env var)."
    ],
    port: 3199,
    providers: [
      {
        _example: true,
        name: "Claude CLI",
        type: "claude-cli",
        base_url: "",
        api_key: "",
        default_model: "claude-sonnet-4-6",
        enabled: true,
        is_default: true
      }
    ],
    users: [],
    settings: {
      auth_enabled: "false",
      cors_mode: "allow_all",
      logging_enabled: "true"
    }
  };

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(template, null, 2), 'utf8');
  console.log(`  Config template created: ${CONFIG_PATH}`);
}

/**
 * Apply config to the database.
 * Must be called AFTER the DB is initialized (i.e. after requiring lib/config).
 */
function applyConfig(cfg) {
  if (!cfg) return;
  const appConfig = require('./config');

  // Apply providers (skip if a provider with the same name already exists)
  if (Array.isArray(cfg.providers)) {
    const existing = appConfig.getAllProviders();
    const existingNames = new Set(existing.map(p => p.name));

    for (const p of cfg.providers) {
      if (p._example) continue;
      if (!p.name || !p.type) continue;
      if (existingNames.has(p.name)) continue;

      appConfig.saveProvider({
        id: crypto.randomUUID(),
        name: p.name,
        type: p.type,
        base_url: p.base_url || '',
        api_key: p.api_key || '',
        default_model: p.default_model || '',
        enabled: p.enabled !== false ? 1 : 0,
        is_default: p.is_default ? 1 : 0,
        model_patterns: p.model_patterns ? JSON.stringify(p.model_patterns) : null,
        extra_config: p.extra_config ? JSON.stringify(p.extra_config) : null,
      });
      console.log(`  [config.json] Provider created: ${p.name} (${p.type})`);
    }
  }

  // Apply users (skip if username already exists)
  if (Array.isArray(cfg.users)) {
    for (const u of cfg.users) {
      if (!u.username || !u.password) continue;
      if (appConfig.getUserByUsername(u.username)) continue;

      appConfig.saveUser({
        username: u.username,
        password: u.password,
        role: u.role || 'admin',
      });
      console.log(`  [config.json] User created: ${u.username}`);
    }
  }

  // Apply settings (every startup)
  if (cfg.settings && typeof cfg.settings === 'object') {
    for (const [key, value] of Object.entries(cfg.settings)) {
      if (key.startsWith('_')) continue;
      appConfig.setSetting(key, String(value));
    }
  }
}

module.exports = { loadConfigFile, createDefaultConfigFile, applyConfig, CONFIG_PATH };
