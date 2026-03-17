const BaseCLIProvider = require("./base-cli");

// OpenAI Codex CLI provider
// Install: npm install -g @openai/codex
// Non-interactive mode: codex exec [PROMPT] --json -m MODEL
// JSONL events: thread.started, turn.started, item.completed, turn.completed
//
// On Windows, shell: true causes cmd.exe to split args on spaces/newlines.
// Extract the last user message and collapse newlines before passing as positional arg.
// Prior context is passed via stdin (codex reads from stdin if provided).
function splitForStdin(prompt) {
  // formatAllMessages output: "[Role]: text\n\n[Role]: text\n\n[User]: lastMsg"
  const lastUserIdx = prompt.lastIndexOf("\n\n[User]: ");
  if (lastUserIdx !== -1) {
    const lastMessage = prompt.slice(lastUserIdx + "\n\n[User]: ".length).replace(/\r?\n/g, " ").trim();
    return { context: prompt.slice(0, lastUserIdx), lastMessage };
  }
  // formatMessages output: "[System]: text\n\nuserText"
  const lastDoubleNl = prompt.lastIndexOf("\n\n");
  if (lastDoubleNl !== -1) {
    const context = prompt.slice(0, lastDoubleNl);
    if (context.startsWith("[System]:") || context.startsWith("[User]:")) {
      const lastMessage = prompt.slice(lastDoubleNl + 2).replace(/\r?\n/g, " ").trim();
      return { context, lastMessage };
    }
  }
  // Single message — collapse newlines for shell safety
  return { context: "", lastMessage: prompt.replace(/\r?\n/g, " ").trim() };
}

module.exports = new BaseCLIProvider({
  name: "codex",
  command: "codex",
  buildArgs(prompt, model) {
    const { context, lastMessage } = splitForStdin(prompt);
    const args = ["exec", lastMessage, "--json", "--skip-git-repo-check"];
    if (model) args.push("-m", model);
    return context ? { args, stdin: context } : args;
  },
  buildStreamArgs(prompt, model) {
    const { context, lastMessage } = splitForStdin(prompt);
    const args = ["exec", lastMessage, "--json", "--skip-git-repo-check"];
    if (model) args.push("-m", model);
    return context ? { args, stdin: context } : args;
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
