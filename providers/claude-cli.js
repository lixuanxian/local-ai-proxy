const BaseCLIProvider = require("./base-cli");

module.exports = new BaseCLIProvider({
  name: "claude",
  command: "claude",
  buildArgs(prompt, model) {
    const args = ["-p", prompt, "--output-format", "json"];
    if (model) args.push("--model", model);
    return args;
  },
  buildStreamArgs(prompt, model) {
    const args = ["-p", prompt, "--output-format", "text"];
    if (model) args.push("--model", model);
    return args;
  },
  parseOutput(stdout) {
    const parsed = JSON.parse(stdout);
    if (parsed.is_error) {
      throw new Error(parsed.result || "Claude CLI returned an error");
    }
    return parsed.result || stdout.trim();
  },
});
