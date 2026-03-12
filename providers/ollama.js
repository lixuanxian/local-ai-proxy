const BaseAPIProvider = require("./base-api");

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";

module.exports = new BaseAPIProvider({
  name: "ollama",
  baseUrl: OLLAMA_HOST,
  chatPath: "/api/chat",

  buildBody(messages, model, stream) {
    return { model: model || "llama3", messages, stream };
  },

  parseResponse(data) {
    return { model: data.model || "ollama", content: data.message?.content || "" };
  },

  parseStreamChunk(line) {
    if (!line) return null;
    try {
      const parsed = JSON.parse(line);
      if (parsed.done) return { done: true };
      if (parsed.message?.content) return { text: parsed.message.content };
    } catch { /* ignore partial JSON */ }
    return null;
  },
});
