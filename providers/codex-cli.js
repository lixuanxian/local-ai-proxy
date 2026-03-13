const BaseCLIProvider = require("./base-cli");

// OpenAI Codex CLI provider
// Install: npm install -g @openai/codex
// Non-interactive mode: codex exec [PROMPT] --json -m MODEL
// JSONL events: thread.started, turn.started, item.completed, turn.completed
module.exports = new BaseCLIProvider({
  name: "codex",
  command: "codex",
  buildArgs(prompt, model) {
    const args = ["exec", prompt, "--json"];
    if (model) args.push("-m", model);
    return args;
  },
  buildStreamArgs(prompt, model) {
    const args = ["exec", prompt, "--json"];
    if (model) args.push("-m", model);
    return args;
  },
  parseOutput(stdout) {
    // --json outputs JSONL: {"type":"item.completed","item":{"type":"agent_message","text":"..."}}
    const lines = stdout.trim().split("\n").filter(Boolean);
    const parts = [];
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (obj.type === "item.completed" && obj.item?.type === "agent_message") {
          parts.push(obj.item.text);
        }
      } catch {
        // skip non-JSON lines
      }
    }
    return parts.join("\n") || stdout.trim();
  },
  parseStreamChunk(line) {
    try {
      const obj = JSON.parse(line);
      if (obj.type === "item.completed" && obj.item?.type === "agent_message") {
        return obj.item.text;
      }
    } catch {
      // skip
    }
    return null;
  },
});
