const BaseCLIProvider = require("./base-cli");

module.exports = new BaseCLIProvider({
  name: "aider",
  command: "aider",
  buildArgs(prompt, model) {
    const args = ["--message", prompt, "--no-git", "--yes-always"];
    if (model) args.push("--model", model);
    return args;
  },
  parseOutput(stdout) {
    return stdout.trim();
  },
});
