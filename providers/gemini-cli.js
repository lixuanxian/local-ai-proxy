const BaseCLIProvider = require("./base-cli");

module.exports = new BaseCLIProvider({
  name: "gemini",
  command: "gemini",
  buildArgs(prompt, model) {
    const args = ["-p", prompt];
    if (model) args.push("--model", model);
    return args;
  },
});
