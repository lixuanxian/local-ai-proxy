const { spawn } = require("child_process");
const { Transform } = require("stream");
const { formatMessages, makeResponse } = require("../lib/utils");

/**
 * Base class for CLI-based providers.
 * Subclasses provide: command, buildArgs(prompt, model), parseOutput(stdout)
 * Optional: buildStreamArgs, parseStreamChunk (for JSON stream output parsing)
 */
// Clean env for CLI subprocesses — strip vars that prevent nested invocation
function getCleanEnv() {
  const env = { ...process.env };
  delete env.CLAUDECODE;
  return env;
}

// Registry name → DB provider ID
const nameToId = {
  claude: 'claude-cli', gemini: 'gemini-cli', codex: 'codex-cli',
  copilot: 'copilot-cli', aider: 'aider-cli', opencode: 'opencode-cli',
};

// Check if a model matches any of the provider's configured model_patterns
function isModelSupported(providerName, model) {
  if (!model) return true;
  try {
    const config = require("../lib/config");
    const dbId = nameToId[providerName] || providerName;
    const provider = config.getProvider(dbId);
    if (!provider || !provider.model_patterns) return true;
    const patterns = typeof provider.model_patterns === 'string'
      ? JSON.parse(provider.model_patterns) : provider.model_patterns;
    if (!Array.isArray(patterns) || patterns.length === 0) return true;
    const m = model.toLowerCase();
    return patterns.some(p => m.includes(p.toLowerCase()));
  } catch {
    return true;
  }
}

class BaseCLIProvider {
  constructor({ name, command, buildArgs, buildStreamArgs, parseOutput, parseStreamChunk }) {
    this.name = name;
    this.command = command;
    this._buildArgs = buildArgs;
    this._buildStreamArgs = buildStreamArgs || buildArgs;
    this._parseOutput = parseOutput || ((s) => s.trim());
    // parseStreamChunk(line) => string|null — extract text from a stream-json line
    this._parseStreamChunk = parseStreamChunk || null;
  }

  // Filter model: if not in provider's model_patterns, drop it
  _filterModel(model) {
    if (!model) return undefined;
    if (!isModelSupported(this.name, model)) {
      console.log(`[CLI:${this.name}] model "${model}" not in supported patterns, omitting --model`);
      return undefined;
    }
    return model;
  }

  async chat(messages, options = {}) {
    const prompt = formatMessages(messages);
    const model = this._filterModel(options.model && options.model !== 'auto' ? options.model : undefined);
    const args = this._buildArgs(prompt, model);

    const safeArgs = args.map((a, i) => i === args.indexOf(prompt) ? `"${prompt.slice(0, 80)}${prompt.length > 80 ? '...' : ''}"` : a);
    console.log(`[CLI:${this.name}] exec: ${this.command} ${safeArgs.join(' ')}`);

    return new Promise((resolve, reject) => {
      const proc = spawn(this.command, args, { shell: true, stdio: ["ignore", "pipe", "pipe"], env: getCleanEnv() });
      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (chunk) => (stdout += chunk));
      proc.stderr.on("data", (chunk) => (stderr += chunk));

      proc.on("close", (code) => {
        console.log(`[CLI:${this.name}] exit code=${code}, stdout=${stdout.length} bytes, stderr=${stderr.length} bytes`);
        if (stderr) console.log(`[CLI:${this.name}] stderr: ${stderr.slice(0, 500)}`);
        if (code !== 0) {
          return reject(new Error(`${this.command} exited with code ${code}: ${stderr.slice(0, 500)}`));
        }
        try {
          const content = this._parseOutput(stdout);
          resolve(makeResponse(this.name, content));
        } catch {
          resolve(makeResponse(this.name, stdout.trim()));
        }
      });

      proc.on("error", (err) => {
        reject(new Error(`Failed to spawn ${this.command}: ${err.message}`));
      });
    });
  }

  chatStream(messages, options = {}) {
    const prompt = formatMessages(messages);
    const model = this._filterModel(options.model && options.model !== 'auto' ? options.model : undefined);
    const args = this._buildStreamArgs(prompt, model);

    const safeArgs = args.map((a, i) => i === args.indexOf(prompt) ? `"${prompt.slice(0, 80)}${prompt.length > 80 ? '...' : ''}"` : a);
    console.log(`[CLI:${this.name}] stream exec: ${this.command} ${safeArgs.join(' ')}`);

    const proc = spawn(this.command, args, { shell: true, stdio: ["ignore", "pipe", "pipe"], env: getCleanEnv() });

    // If provider has a stream chunk parser, wrap stdout through a transform
    // that extracts text from JSON stream lines
    if (this._parseStreamChunk) {
      const parser = this._parseStreamChunk;
      let buffer = "";
      const transform = new Transform({
        transform(chunk, encoding, callback) {
          buffer += chunk.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop(); // keep incomplete last line in buffer
          for (const line of lines) {
            if (!line.trim()) continue;
            const text = parser(line);
            if (text) this.push(text);
          }
          callback();
        },
        flush(callback) {
          if (buffer.trim()) {
            const text = parser(buffer);
            if (text) this.push(text);
          }
          callback();
        },
      });

      proc.stdout.pipe(transform);

      // Return a proc-like object: the caller checks for .stdout
      // Replace stdout with our transform stream
      const wrapper = Object.create(proc);
      wrapper.stdout = transform;
      return wrapper;
    }

    return proc;
  }
}

module.exports = BaseCLIProvider;
