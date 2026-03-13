/**
 * Provider registry - loads, stores, and resolves providers.
 */
class ProviderRegistry {
  constructor() {
    this._providers = new Map();
    this._defaultProvider = "claude";
  }

  register(name, provider) {
    this._providers.set(name, provider);
  }

  get(name) {
    return this._providers.get(name);
  }

  listNames() {
    return [...this._providers.keys()];
  }

  setDefault(name) {
    this._defaultProvider = name;
  }

  getDefault() {
    return this._defaultProvider;
  }

  /**
   * Resolve provider name from explicit name, model string, or default.
   * Also accepts DB provider IDs (e.g. "claude-cli") and maps them to registry names.
   */
  resolve(providerName, model) {
    if (providerName && this._providers.has(providerName)) return providerName;

    // Map common DB provider IDs to registry names
    if (providerName) {
      const mapped = idToName[providerName];
      if (mapped && this._providers.has(mapped)) return mapped;
    }

    if (model) {
      const m = model.toLowerCase();
      if (m.includes("claude") || m.includes("sonnet") || m.includes("opus") || m.includes("haiku")) return this._has("claude");
      if (m.includes("gemini") || m.includes("gemma")) return this._has("gemini");
      if (m.includes("codex")) return this._has("codex");
      if (m.includes("gpt") || m.includes("o1-") || m.startsWith("o1") || m.includes("o3") || m.includes("o4")) return this._has("openai");

      if (m.includes("aider")) return this._has("aider");
      if (m.includes("opencode")) return this._has("opencode");
      if (m.includes("copilot")) return this._has("copilot");
    }

    return this._defaultProvider;
  }

  /** Return the name if registered, otherwise fall back to default */
  _has(name) {
    return this._providers.has(name) ? name : this._defaultProvider;
  }
}

/**
 * Create a registry pre-loaded with built-in providers.
 */
// Map DB provider IDs to registry names
const idToName = {
  'claude-cli': 'claude', 'gemini-cli': 'gemini', 'codex-cli': 'codex',
  'copilot-cli': 'copilot', 'aider-cli': 'aider', 'opencode-cli': 'opencode',
  'openai': 'openai', 'ollama': 'openai',
};

function createDefaultRegistry() {
  const config = require("./config");
  const registry = new ProviderRegistry();

  // Load built-in providers
  const builtins = {
    claude: "../providers/claude-cli",
    gemini: "../providers/gemini-cli",

    openai: "../providers/openai-compat",
    codex: "../providers/codex-cli",
    aider: "../providers/aider-cli",
    opencode: "../providers/opencode-cli",
    copilot: "../providers/copilot-cli",
  };

  for (const [name, modulePath] of Object.entries(builtins)) {
    try {
      const provider = require(modulePath);
      registry.register(name, provider);
    } catch (err) {
      console.warn(`[WARN] Failed to load provider "${name}": ${err.message}`);
    }
  }

  // Resolve default: DB setting > env var > "claude"
  const dbDefault = config.getDefaultProvider();
  const dbDefaultName = dbDefault ? (idToName[dbDefault.id] || dbDefault.id) : null;
  const defaultProvider = (dbDefaultName && registry.get(dbDefaultName))
    ? dbDefaultName
    : (process.env.DEFAULT_PROVIDER || "claude");
  registry.setDefault(defaultProvider);
  return registry;
}

module.exports = { ProviderRegistry, createDefaultRegistry, idToName };
