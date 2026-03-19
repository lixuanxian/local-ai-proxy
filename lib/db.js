const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { getDataDir, isPkg } = require('./paths');

const DEBUG = process.argv.includes('--debug') || process.env.DEBUG === '1';
function dbDebug(...args) {
  if (!DEBUG) return;
  console.log('[DEBUG:db]', ...args);
}

const DATA_DIR = getDataDir();
const DB_PATH = path.join(DATA_DIR, "proxy.db");
dbDebug('DATA_DIR:', DATA_DIR);
dbDebug('DB_PATH:', DB_PATH);

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  dbDebug('Creating data directory...');
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In pkg environment, locate the native .node file on the real filesystem.
// The post-pkg script (scripts/post-pkg.js) copies it next to the exe during build.
const dbOptions = {};
if (isPkg) {
  const exeDir = path.dirname(process.execPath);
  const targetNodePath = path.join(exeDir, 'better_sqlite3.node');
  dbDebug('exeDir:', exeDir);
  dbDebug('targetNodePath:', targetNodePath, '| exists:', fs.existsSync(targetNodePath));

  if (!fs.existsSync(targetNodePath)) {
    console.error(`[FATAL] Native SQLite module not found: ${targetNodePath}`);
    console.error('  The file "better_sqlite3.node" must be placed next to the exe.');
    console.error('  This is done automatically by: node scripts/post-pkg.js');
    console.error('  Or use "npm run dist:win" which runs all build steps.');
    process.exit(1);
  }
  dbOptions.nativeBinding = targetNodePath;
}

dbDebug('Opening database...');
let Database;
try {
  Database = require("better-sqlite3");
  dbDebug('better-sqlite3 module loaded');
} catch (err) {
  console.error('[FATAL] Cannot load better-sqlite3:', err.message);
  if (isPkg) {
    console.error('  Hint: better-sqlite3 is a native module. Make sure the .node binary matches your Node.js version and platform.');
    console.error('  The pkg target must match the installed better-sqlite3 platform (node22-win-x64).');
  }
  process.exit(1);
}
const db = new Database(DB_PATH, dbOptions);
dbDebug('Database opened successfully');

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

  CREATE TABLE IF NOT EXISTS conversations (
    id            TEXT PRIMARY KEY,
    title         TEXT NOT NULL DEFAULT 'New Chat',
    provider_id   TEXT,
    model         TEXT,
    system_prompt TEXT,
    temperature   REAL,
    max_tokens    INTEGER,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id              TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role            TEXT NOT NULL,
    content         TEXT NOT NULL DEFAULT '',
    attachments     TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS skills (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    description     TEXT,
    prompt_template TEXT NOT NULL,
    enabled         INTEGER NOT NULL DEFAULT 1,
    sort_order      INTEGER DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cors_origins (
    id         TEXT PRIMARY KEY,
    origin     TEXT NOT NULL UNIQUE,
    name       TEXT,
    status     TEXT NOT NULL DEFAULT 'pending',
    first_seen TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS api_tokens (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    token        TEXT NOT NULL UNIQUE,
    enabled      INTEGER NOT NULL DEFAULT 1,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    last_used_at TEXT
  );

  CREATE TABLE IF NOT EXISTS users (
    id         TEXT PRIMARY KEY,
    username   TEXT NOT NULL UNIQUE,
    password   TEXT NOT NULL,
    role       TEXT NOT NULL DEFAULT 'admin',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS mcp_servers (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    url             TEXT NOT NULL,
    transport_type  TEXT NOT NULL DEFAULT 'streamable-http',
    headers         TEXT,
    enabled         INTEGER NOT NULL DEFAULT 1,
    sort_order      INTEGER DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS model_mappings (
    id          TEXT PRIMARY KEY,
    model_name  TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    priority    INTEGER DEFAULT 0,
    source      TEXT NOT NULL DEFAULT 'auto',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,
    UNIQUE(model_name, provider_id)
  );
`);

// Migrations for existing databases
try {
  db.exec(`ALTER TABLE conversations ADD COLUMN system_prompt TEXT`);
} catch { /* column already exists */ }
try {
  db.exec(`ALTER TABLE conversations ADD COLUMN temperature REAL`);
} catch { /* column already exists */ }
try {
  db.exec(`ALTER TABLE conversations ADD COLUMN max_tokens INTEGER`);
} catch { /* column already exists */ }
try {
  db.exec(`ALTER TABLE conversations ADD COLUMN context_limit INTEGER DEFAULT 10`);
} catch { /* column already exists */ }
try {
  db.exec(`ALTER TABLE conversations ADD COLUMN auto_compress INTEGER DEFAULT 1`);
} catch { /* column already exists */ }
try {
  db.exec(`ALTER TABLE messages ADD COLUMN is_summary INTEGER DEFAULT 0`);
} catch { /* column already exists */ }
try {
  db.exec(`ALTER TABLE messages ADD COLUMN token_estimate INTEGER DEFAULT 0`);
} catch { /* column already exists */ }
try {
  db.exec(`ALTER TABLE messages ADD COLUMN summarizes_up_to TEXT`);
} catch { /* column already exists */ }
try {
  db.exec(`ALTER TABLE cors_origins ADD COLUMN icon TEXT`);
} catch { /* column already exists */ }
try {
  db.exec(`ALTER TABLE cors_origins ADD COLUMN description TEXT`);
} catch { /* column already exists */ }
try {
  db.exec(`ALTER TABLE cors_origins ADD COLUMN title TEXT`);
} catch { /* column already exists */ }
try {
  db.exec(`ALTER TABLE api_tokens ADD COLUMN expires_at TEXT`);
} catch { /* column already exists */ }
try {
  db.exec(`ALTER TABLE providers ADD COLUMN priority INTEGER DEFAULT 0`);
} catch { /* column already exists */ }
// Seed default settings if empty
const settingsCount = db.prepare("SELECT COUNT(*) as c FROM settings").get();
if (settingsCount.c === 0) {
  const insert = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
  insert.run("logging_enabled", "true");
  insert.run("default_provider_id", process.env.DEFAULT_PROVIDER || "claude-cli");
  insert.run("port", String(process.env.PORT || 3199));
  insert.run("cors_mode", "allow_all");
  insert.run("auth_enabled", "false");
}
// Ensure cors_mode setting exists for existing databases
const corsModeSetting = db.prepare("SELECT value FROM settings WHERE key = 'cors_mode'").get();
if (!corsModeSetting) {
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").run("cors_mode", "allow_all");
}
// Ensure auto_compress setting exists (default off)
db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").run("auto_compress", "false");

// Seed default providers if empty
const providerCount = db.prepare("SELECT COUNT(*) as c FROM providers").get();
if (providerCount.c === 0) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO providers (id, name, type, enabled, is_default, command, base_url, api_key, default_model, model_patterns)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insert.run("claude-cli", "Claude CLI", "claude-cli", 1, 1, null, "https://api.anthropic.com", null, "claude-sonnet-4-6",
    JSON.stringify(["claude", "sonnet", "opus", "haiku"]));
  insert.run("gemini-cli", "Gemini CLI", "gemini-cli", 1, 0, "gemini", null, null, "gemini-3-flash-preview",
    JSON.stringify(["gemini", "gemma"]));
  insert.run("ollama", "Ollama", "openai-api", 1, 0, null, (process.env.OLLAMA_HOST || "http://localhost:11434") + "/v1", null, "llama3",
    JSON.stringify(["llama", "mistral", "qwen", "phi", "deepseek"]));
  insert.run("openai", "OpenAI Compatible", "openai-api", 1, 0, null,
    process.env.OPENAI_BASE_URL || "http://localhost:1234",
    process.env.OPENAI_API_KEY || null, "gpt-5.4",
    JSON.stringify(["gpt", "o1", "o3", "o4"]));
  insert.run("copilot-cli", "GitHub Copilot", "copilot-cli", 1, 0, "copilot", null, null, "claude-sonnet-4.6",
    null);
  insert.run("codex-cli", "Codex CLI", "codex-cli", 1, 0, "codex", null, null, null,
    JSON.stringify(["codex"]));
}

// Seed default skills if empty
const skillsCount = db.prepare("SELECT COUNT(*) as c FROM skills").get();
if (skillsCount.c === 0) {
  const insertSkill = db.prepare(`
    INSERT OR IGNORE INTO skills (id, name, description, prompt_template, enabled, sort_order)
    VALUES (?, ?, ?, ?, 1, ?)
  `);
  insertSkill.run("code-review", "Code Review", "Analyze code for quality, bugs, and improvements",
    "Please review the following code. Identify bugs, potential issues, and suggest improvements:\n\n", 0);
  insertSkill.run("explain-code", "Explain Code", "Explain code in detail with examples",
    "Please explain the following code in detail. Break down what each part does:\n\n", 1);
  insertSkill.run("translate", "Translate", "Translate text between languages",
    "Please translate the following text. If no target language is specified, translate to English:\n\n", 2);
  insertSkill.run("summarize", "Summarize", "Summarize long text concisely",
    "Please provide a concise summary of the following text:\n\n", 3);
  insertSkill.run("write-tests", "Write Tests", "Generate unit tests for code",
    "Please write comprehensive unit tests for the following code:\n\n", 4);
}

// Seed admin user from environment variables if no users exist
const usersCount = db.prepare("SELECT COUNT(*) as c FROM users").get();
if (usersCount.c === 0 && process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) {
  const bcrypt = require("bcryptjs");
  const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10);
  db.prepare("INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, 'admin')")
    .run(crypto.randomUUID(), process.env.ADMIN_USERNAME, hash);
  // Auto-enable auth when bootstrapping from env vars
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('auth_enabled', 'true')").run();
}

module.exports = db;
