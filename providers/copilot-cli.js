const BaseCLIProvider = require("./base-cli");

// GitHub Copilot CLI provider
// Install: npm install -g @github/copilot  (or winget install GitHub.Copilot)
// Flags: -p (prompt), -s (non-interactive), --output-format (text|json), --model
// Session: --resume=<session-id> (resume specific session), --continue (resume most recent)
// JSON events: assistant.message (data.content), assistant.message_delta (data.deltaContent)
// Result event: {"type":"result","sessionId":"<uuid>", ...}
module.exports = new BaseCLIProvider({
  name: "copilot",
  command: "copilot",
  supportsSession: true,
  buildArgs(prompt, model, sessionOpts) {
    // Use json format for non-streaming — allows session ID extraction from result event
    const args = ["-p", prompt, "-s", "--output-format", "json"];
    if (model) args.push("--model", model);
    if (sessionOpts?.isResume && sessionOpts?.sessionId) {
      args.push(`--resume=${sessionOpts.sessionId}`);
    } else if (sessionOpts?.isResume) {
      args.push("--continue");
    }
    return args;
  },
  buildStreamArgs(prompt, model, sessionOpts) {
    // Use json format for streaming — provides incremental delta events
    const args = ["-p", prompt, "-s", "--output-format", "json"];
    if (model) args.push("--model", model);
    if (sessionOpts?.isResume && sessionOpts?.sessionId) {
      args.push(`--resume=${sessionOpts.sessionId}`);
    } else if (sessionOpts?.isResume) {
      args.push("--continue");
    }
    return args;
  },
  parseOutput(stdout) {
    // json format JSONL: extract content from assistant.message events
    const lines = stdout.trim().split("\n");
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (obj.type === "assistant.message" && obj.data?.content) {
          return obj.data.content;
        }
      } catch {
        // skip non-JSON lines
      }
    }
    // Fallback: return raw output
    return stdout.trim();
  },
  parseStreamChunk(line) {
    // json format JSONL: {"type":"assistant.message_delta","data":{"deltaContent":"..."}}
    // Fallback: {"type":"assistant.message","data":{"content":"..."}} (non-delta mode)
    try {
      const obj = JSON.parse(line);
      if (obj.type === "assistant.message_delta" && obj.data?.deltaContent) {
        return obj.data.deltaContent;
      }
      if (obj.type === "assistant.message" && obj.data?.content) {
        return obj.data.content;
      }
      // Recognized JSON but no content field — ignore (e.g. result event)
      return null;
    } catch {
      // Not JSON — copilot may output plain text in streaming mode
      return line || null;
    }
  },
  parseSessionId(stdout) {
    // Extract sessionId from the result event: {"type":"result","sessionId":"<uuid>",...}
    const lines = stdout.trim().split("\n");
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (obj.type === "result" && obj.sessionId) {
          return obj.sessionId;
        }
      } catch {
        // skip non-JSON lines
      }
    }
    return null;
  },
});
