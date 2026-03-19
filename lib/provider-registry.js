/**
 * Provider registry - loads, stores, and resolves providers.
 */
class ProviderRegistry {
  constructor() {
    this._providers = new Map();
    this._defaultProvider = "copilot"; // Fallback default (can be overridden by DB setting or env var)
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
   *
   * Returns { name, modelMatched } where modelMatched indicates whether the
   * model was actually matched by a provider's model_patterns.
   * When modelMatched is false, callers should NOT pass the model to the provider
   * (especially CLI providers that would pass an unsupported --model flag).
   *
   * Resolution order:
   * 1. Explicit provider name (direct or mapped from DB ID)
   * 2. Model name matched against DB providers' model_patterns (only enabled providers)
   * 3. Default provider
   */
  resolve(providerName, model) {
    const config = require("./config");

    // 1. Explicit provider name — check if the provider is enabled
    if (providerName) {
      const directName = this._providers.has(providerName) ? providerName
        : (idToName[providerName] && this._providers.has(idToName[providerName])) ? idToName[providerName]
        : null;
      if (directName) {
        // Check enabled status in DB
        const dbId = Object.entries(idToName).find(([, v]) => v === directName)?.[0] || directName;
        const dbProvider = config.getProvider(dbId);
        if (!dbProvider || dbProvider.enabled) {
          const prefixRule = MODEL_PREFIX_RULES[directName];
          const matched = !prefixRule || !model || model.toLowerCase().startsWith(prefixRule);
          return { name: directName, modelMatched: matched };
        }
        // Provider is explicitly disabled — don't use it, fall through to model match
      }
    }

    // 2a. Exact model mapping from model_mappings table (user-customizable priority)
    if (model) {
      const mapping = config.resolveModelProvider(model);
      if (mapping && mapping.provider_id) {
        const mappedProvider = config.getProvider(mapping.provider_id);
        const registryName = mappedProvider ? dbToRegistryName(mappedProvider) : (idToName[mapping.provider_id] || mapping.provider_id);
        if (this._providers.has(registryName)) return { name: registryName, modelMatched: true, dbProviderId: mapping.provider_id };
      }
    }

    // 2b. Model-based matching using DB providers' model_patterns (only enabled providers, respects priority order)
    if (model) {
      const allProviders = config.getAllProviders();
      const m = model.toLowerCase();

      for (const p of allProviders) {
        if (!p.enabled) continue;
        if (!p.model_patterns) continue;

        let patterns;
        try {
          patterns = typeof p.model_patterns === "string" ? JSON.parse(p.model_patterns) : p.model_patterns;
        } catch { continue; }
        if (!Array.isArray(patterns) || patterns.length === 0) continue;

        for (const pattern of patterns) {
          if (m.includes(pattern.toLowerCase())) {
            const registryName = dbToRegistryName(p);
            if (this._providers.has(registryName)) return { name: registryName, modelMatched: true, dbProviderId: p.id };
          }
        }
      }
    }

    // 3. Default provider — only if enabled (model was NOT matched)
    const defaultDb = config.getDefaultProvider();
    if (defaultDb && defaultDb.enabled) {
      const defaultName = dbToRegistryName(defaultDb);
      if (this._providers.has(defaultName)) return { name: defaultName, modelMatched: false, dbProviderId: defaultDb.id };
    }

    // 4. Fallback: first enabled provider (model was NOT matched)
    const allProviders = config.getAllProviders();
    for (const p of allProviders) {
      if (!p.enabled) continue;
      const registryName = dbToRegistryName(p);
      if (this._providers.has(registryName)) return { name: registryName, modelMatched: false, dbProviderId: p.id };
    }

    // Nothing enabled — return default anyway (will likely error)
    return { name: this._defaultProvider, modelMatched: false };
  }
}

// Model prefix requirements for CLI providers.
// If the model doesn't start with the required prefix, it won't be passed to the provider.
const MODEL_PREFIX_RULES = {
  'claude-cli': 'claude',
  'gemini': 'gemini',
  'codex': 'gpt',
};

/**
 * Create a registry pre-loaded with built-in providers.
 */
// Map DB provider IDs to registry names
const idToName = {
  'claude-cli': 'claude-cli', 'gemini-cli': 'gemini', 'codex-cli': 'codex',
  'copilot-cli': 'copilot',
  'openai': 'openai', 'ollama': 'openai',
};

// Map DB provider types to registry names (fallback for UUID-based provider IDs)
const typeToRegistry = {
  'claude-cli': 'claude-cli',
  'gemini-cli': 'gemini', 'gemini-api': 'gemini',
  'openai-api': 'openai',
  'copilot-cli': 'copilot', 'codex-cli': 'codex',
};

/** Map a DB provider row to a registry name, trying id → idToName → type */
function dbToRegistryName(p) {
  return idToName[p.id] || typeToRegistry[p.type] || p.id;
}

function createDefaultRegistry() {
  const config = require("./config");
  const registry = new ProviderRegistry();

  // Load built-in providers — static requires so esbuild/pkg can resolve them
  const builtins = [
    ['claude-cli', () => require("../providers/claude-cli")],
    ['gemini',     () => require("../providers/gemini-cli")],
    ['openai',     () => require("../providers/openai-compat")],
    ['codex',      () => require("../providers/codex-cli")],
    ['copilot',    () => require("../providers/copilot-cli")],
  ];

  for (const [name, loader] of builtins) {
    try {
      const provider = loader();
      registry.register(name, provider);
    } catch (err) {
      console.warn(`[WARN] Failed to load provider "${name}": ${err.message}`);
    }
  }

  // Resolve default: DB setting > env var > "claude"
  const dbDefault = config.getDefaultProvider();
  const dbDefaultName = dbDefault ? dbToRegistryName(dbDefault) : null;
  const defaultProvider = (dbDefaultName && registry.get(dbDefaultName))
    ? dbDefaultName
    : (process.env.DEFAULT_PROVIDER || "claude-cli");
  registry.setDefault(defaultProvider);
  return registry;
}

module.exports = { ProviderRegistry, createDefaultRegistry, idToName, dbToRegistryName };
