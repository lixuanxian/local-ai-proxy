const BaseCLIProvider = require("./base-cli");

// Gemini CLI provider
// Install: npm install -g @google/gemini-cli
// Flags: -p (prompt), -m (model), -o (output-format: text|json|stream-json), -y (yolo)
module.exports = new BaseCLIProvider({
  name: "gemini",
  command: "gemini",
  buildArgs(prompt, model) {
    // Use json format for non-streaming — much faster than stream-json
    const args = ["-p", prompt, "-o", "json", "-y"];
    if (model) args.push("-m", model);
    return args;
  },
  buildStreamArgs(prompt, model) {
    // Use stream-json for streaming — delivers incremental chunks
    const args = ["-p", prompt, "-o", "stream-json", "-y"];
    if (model) args.push("-m", model);
    return args;
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
});
