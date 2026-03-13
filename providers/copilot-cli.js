const BaseCLIProvider = require("./base-cli");

// GitHub Copilot CLI provider
// Install: npm install -g @github/copilot  (or winget install GitHub.Copilot)
// Flags: -p (prompt), -s (non-interactive), --output-format (text|json), --model
// JSON events: assistant.message (data.content), assistant.message_delta (data.deltaContent)
module.exports = new BaseCLIProvider({
  name: "copilot",
  command: "copilot",
  buildArgs(prompt, model) {
    // Use text format for non-streaming — simpler and avoids JSON parsing overhead
    const args = ["-p", prompt, "-s", "--output-format", "text"];
    if (model) args.push("--model", model);
    return args;
  },
  buildStreamArgs(prompt, model) {
    // Use json format for streaming — provides incremental delta events
    const args = ["-p", prompt, "-s", "--output-format", "json"];
    if (model) args.push("--model", model);
    return args;
  },
  parseOutput(stdout) {
    // text format: plain text response
    return stdout.trim();
  },
  parseStreamChunk(line) {
    // json format JSONL: {"type":"assistant.message_delta","data":{"deltaContent":"..."}}
    try {
      const obj = JSON.parse(line);
      if (obj.type === "assistant.message_delta" && obj.data?.deltaContent) {
        return obj.data.deltaContent;
      }
    } catch {
      // skip non-JSON lines
    }
    return null;
  },
});
