const { spawn } = require("child_process");
const { formatMessages, makeResponse } = require("../lib/utils");

// OpenCode CLI provider - uses opencode in non-interactive mode
module.exports = {
  name: "opencode",

  async chat(messages, options = {}) {
    const prompt = formatMessages(messages);
    const args = ["run", prompt];
    if (options.model) args.push("--model", options.model);

    return new Promise((resolve, reject) => {
      const proc = spawn("opencode", args, { shell: true });
      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (chunk) => (stdout += chunk));
      proc.stderr.on("data", (chunk) => (stderr += chunk));

      proc.on("close", (code) => {
        if (code !== 0) {
          return reject(new Error(`opencode exited with code ${code}: ${stderr}`));
        }
        resolve(makeResponse("opencode", stdout.trim()));
      });

      proc.on("error", (err) => {
        reject(new Error(`Failed to spawn opencode: ${err.message}. Install from: https://github.com/opencode-ai/opencode`));
      });
    });
  },

  chatStream(messages, options = {}) {
    const prompt = formatMessages(messages);
    const args = ["run", prompt];
    if (options.model) args.push("--model", options.model);
    return spawn("opencode", args, { shell: true });
  },
};
