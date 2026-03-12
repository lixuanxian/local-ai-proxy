const BaseCLIProvider = require("./base-cli");

module.exports = new BaseCLIProvider({
  name: "claude",
  command: "claude",
  buildArgs(prompt, model) {
    const args = ["-p", prompt, "--output-format", "json"];
    if (model) args.push("--model", model);
    return args;
  },
  parseOutput(stdout) {
    const parsed = JSON.parse(stdout);
    return parsed.result || stdout.trim();
  },
});
