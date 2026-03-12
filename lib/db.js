const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_PATH = path.join(DATA_DIR, "proxy.db");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");

// Run migrations
db.exec(`
  CREATE TABLE IF NOT EXISTS providers (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    type          TEXT NOT NULL,
    enabled       INTEGER NOT NULL DEFAULT 1,
    is_default    INTEGER NOT NULL DEFAULT 0,
    command       TEXT,
    base_url      TEXT,
    api_key       TEXT,
    default_model TEXT,
    model_patterns TEXT,
    extra_config  TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS request_logs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp     TEXT NOT NULL DEFAULT (datetime('now')),
    api_format    TEXT,
    provider_id   TEXT,
    model         TEXT,
    request_body  TEXT,
    response_body TEXT,
    status_code   INTEGER,
    input_tokens  INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    latency_ms    INTEGER,
    error         TEXT
  );

  CREATE TABLE IF NOT EXISTS apps (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    url         TEXT NOT NULL,
    icon        TEXT,
    description TEXT,
    cors_origin TEXT,
    sort_order  INTEGER DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS docker_configs (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    image           TEXT NOT NULL,
    cpu_limit       TEXT DEFAULT '1',
    memory_limit    TEXT DEFAULT '512m',
    timeout_seconds INTEGER DEFAULT 300,
    enabled         INTEGER NOT NULL DEFAULT 0,
    network         TEXT DEFAULT 'none',
    workspace_path  TEXT,
    env_vars        TEXT,
    sandbox_mode    INTEGER NOT NULL DEFAULT 0,
    extra_config    TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migrations for existing databases
try {
  db.exec(`ALTER TABLE docker_configs ADD COLUMN network TEXT DEFAULT 'none'`);
} catch { /* column already exists */ }
try {
  db.exec(`ALTER TABLE docker_configs ADD COLUMN workspace_path TEXT`);
} catch { /* column already exists */ }
try {
  db.exec(`ALTER TABLE docker_configs ADD COLUMN env_vars TEXT`);
} catch { /* column already exists */ }
try {
  db.exec(`ALTER TABLE docker_configs ADD COLUMN sandbox_mode INTEGER NOT NULL DEFAULT 0`);
} catch { /* column already exists */ }

// Seed default settings if empty
const settingsCount = db.prepare("SELECT COUNT(*) as c FROM settings").get();
if (settingsCount.c === 0) {
  const insert = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
  insert.run("logging_enabled", "true");
  insert.run("default_provider_id", process.env.DEFAULT_PROVIDER || "claude-cli");
  insert.run("port", String(process.env.PORT || 3199));
}

// Seed default providers if empty
const providerCount = db.prepare("SELECT COUNT(*) as c FROM providers").get();
if (providerCount.c === 0) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO providers (id, name, type, enabled, is_default, command, base_url, api_key, default_model, model_patterns)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insert.run("claude-cli", "Claude CLI", "cli", 1, 1, "claude", null, null, null,
    JSON.stringify(["claude", "sonnet", "opus", "haiku"]));
  insert.run("gemini-cli", "Gemini CLI", "cli", 1, 0, "gemini", null, null, null,
    JSON.stringify(["gemini", "gemma"]));
  insert.run("ollama", "Ollama", "ollama", 1, 0, null, process.env.OLLAMA_HOST || "http://localhost:11434", null, "llama3",
    JSON.stringify(["llama", "mistral", "qwen", "phi", "deepseek"]));
  insert.run("openai", "OpenAI Compatible", "openai-api", 1, 0, null,
    process.env.OPENAI_BASE_URL || "http://localhost:1234",
    process.env.OPENAI_API_KEY || null, "gpt-4",
    JSON.stringify(["gpt", "o1", "o3", "o4"]));
  insert.run("copilot-cli", "GitHub Copilot", "cli", 1, 0, "gh", null, null, null,
    JSON.stringify(["copilot"]));
}

module.exports = db;
