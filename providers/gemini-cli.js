const BaseCLIProvider = require("./base-cli");

// Gemini CLI provider
// Install: npm install -g @google/gemini-cli
// Flags: -p (prompt), -m (model), -o (output-format: text|json|stream-json), -y (yolo)
// Session: -r/--resume <uuid|index|"latest">, --list-sessions
// JSON output: {"session_id":"<uuid>","response":"...","stats":{...}}
//
// Prompt is passed via stdin (not -p) to avoid Windows cmd.exe argument escaping issues.
// Characters like % in the prompt get expanded by cmd.exe when passed as CLI args via
// shell: true, causing spawn EINVAL. Stdin bypasses all shell interpretation.
module.exports = new BaseCLIProvider({
  name: "gemini",
  command: "gemini",
  supportsSession: true,
  buildArgs(prompt, model, sessionOpts) {
    // Use json format for non-streaming — includes session_id in output.
    // Prompt is passed via stdin; see base-cli.js { args, stdin } return format.
    const args = ["-o", "json", "-y"];
    if (model) args.push("-m", model);
    if (sessionOpts?.isResume && sessionOpts?.sessionId) {
      // Resume a specific session by UUID
      args.push("--resume", sessionOpts.sessionId);
    } else if (sessionOpts?.isResume) {
      // No known session ID yet — resume the most recent session
      args.push("--resume", "latest");
    }
    return { args, stdin: prompt };
  },
  buildStreamArgs(prompt, model, sessionOpts) {
    // Use stream-json for streaming — delivers incremental chunks.
    // Prompt is passed via stdin; same reason as buildArgs above.
    const args = ["-o", "stream-json", "-y"];
    if (model) args.push("-m", model);
    if (sessionOpts?.isResume && sessionOpts?.sessionId) {
      args.push("--resume", sessionOpts.sessionId);
    } else if (sessionOpts?.isResume) {
      args.push("--resume", "latest");
    }
    return { args, stdin: prompt };
  },
  parseOutput(stdout) {
    // json format: single JSON object with "response" field
    // May have non-JSON lines before it (YOLO mode warnings on stderr leak)
    const lines = stdout.trim().split("\n");
    // Try parsing the full output as one JSON block (pretty-printed)
    try {
      const obj = JSON.parse(stdout);
      if (obj.response) return obj.response;
    } catch {
      // Not a single JSON object, try line-by-line
    }
    // Fallback: look for stream-json lines
    const parts = [];
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (obj.response) return obj.response;
        if (obj.type === "message" && obj.role === "assistant" && obj.content) {
          parts.push(obj.content);
        }
      } catch {
        // skip non-JSON lines
      }
    }
    return parts.join("") || stdout.trim();
  },
  parseStreamChunk(line) {
    try {
      const obj = JSON.parse(line);
      if (obj.type === "message" && obj.role === "assistant" && obj.content) {
        return obj.content;
      }
    } catch {
      // ignore non-JSON lines
    }
    return null;
  },
  parseSessionId(stdout) {
    // Extract session_id from JSON output: {"session_id":"<uuid>","response":"..."}
    try {
      const obj = JSON.parse(stdout);
      return obj.session_id || null;
    } catch {
      return null;
    }
  },
});
