const { spawn } = require("child_process");
const { formatMessages, makeResponse } = require("../lib/utils");

// GitHub Copilot provider - uses gh copilot explain
// Requires: gh extension install github/gh-copilot
module.exports = {
  name: "copilot",

  async chat(messages, options = {}) {
    const prompt = formatMessages(messages);
    const args = ["copilot", "explain", prompt];

    return new Promise((resolve, reject) => {
      const proc = spawn("gh", args, {
        shell: true,
        env: { ...process.env, GH_PROMPT: "disable" },
      });
      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (chunk) => (stdout += chunk));
      proc.stderr.on("data", (chunk) => (stderr += chunk));

      proc.on("close", (code) => {
        if (code !== 0) {
          return reject(new Error(`gh copilot exited with code ${code}: ${stderr}`));
        }
        resolve(makeResponse("copilot", stdout.trim()));
      });

      proc.on("error", (err) => {
        reject(new Error(`Failed to spawn gh copilot: ${err.message}. Install with: gh extension install github/gh-copilot`));
      });
    });
  },

  chatStream(messages, options = {}) {
    const prompt = formatMessages(messages);
    const args = ["copilot", "explain", prompt];
    return spawn("gh", args, {
      shell: true,
      env: { ...process.env, GH_PROMPT: "disable" },
    });
  },
};
