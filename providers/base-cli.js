const { spawn } = require("child_process");
const { formatMessages, makeResponse } = require("../lib/utils");

/**
 * Base class for CLI-based providers.
 * Subclasses provide: command, buildArgs(prompt, model), parseOutput(stdout)
 */
class BaseCLIProvider {
  constructor({ name, command, buildArgs, parseOutput }) {
    this.name = name;
    this.command = command;
    // buildArgs(prompt, model) => string[]
    this._buildArgs = buildArgs;
    // parseOutput(stdout) => string  (optional, defaults to trimming)
    this._parseOutput = parseOutput || ((s) => s.trim());
  }

  async chat(messages, options = {}) {
    const prompt = formatMessages(messages);
    const model = options.model || undefined;
    const args = this._buildArgs(prompt, model);

    return new Promise((resolve, reject) => {
      const proc = spawn(this.command, args, { shell: true });
      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (chunk) => (stdout += chunk));
      proc.stderr.on("data", (chunk) => (stderr += chunk));

      proc.on("close", (code) => {
        if (code !== 0) {
          return reject(new Error(`${this.command} exited with code ${code}: ${stderr}`));
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
    const model = options.model || undefined;
    const args = this._buildArgs(prompt, model);
    return spawn(this.command, args, { shell: true });
  }
}

module.exports = BaseCLIProvider;
