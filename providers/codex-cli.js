const BaseCLIProvider = require("./base-cli");

module.exports = new BaseCLIProvider({
  name: "codex",
  command: "codex",
  buildArgs(prompt, model) {
    const args = ["-q", prompt];
    if (model) args.push("--model", model);
    return args;
  },
  parseOutput(stdout) {
    return stdout.trim();
  },
});
