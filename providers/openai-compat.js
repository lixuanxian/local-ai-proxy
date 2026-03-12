const BaseAPIProvider = require("./base-api");

const OPENAI_BASE = process.env.OPENAI_BASE_URL || "http://localhost:1234";
const OPENAI_KEY = process.env.OPENAI_API_KEY || "";

module.exports = new BaseAPIProvider({
  name: "openai",
  baseUrl: OPENAI_BASE,
  apiKey: OPENAI_KEY,
  chatPath: "/v1/chat/completions",

  buildBody(messages, model, stream) {
    return { model: model || "gpt-4", messages, stream };
  },

  parseResponse(data) {
    // Already in OpenAI format, return as-is
    return data;
  },

  parseStreamChunk(line) {
    if (!line || !line.startsWith("data: ")) return null;
    const payload = line.slice(6);
    if (payload === "[DONE]") return { done: true };
    try {
      const parsed = JSON.parse(payload);
      const text = parsed.choices?.[0]?.delta?.content;
      if (text) return { text };
    } catch { /* ignore */ }
    return null;
  },
});
