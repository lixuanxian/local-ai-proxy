const https = require("https");
const { EventEmitter } = require("events");
const { makeResponse } = require("../lib/utils");

/**
 * Google AI Studio (Gemini) API provider.
 * Uses the generativelanguage.googleapis.com REST API.
 */
class GeminiAPIProvider {
  constructor({ name, apiKey, defaultModel }) {
    this.name = name || "gemini-api";
    this.apiKey = apiKey || "";
    this.defaultModel = defaultModel || "gemini-2.0-flash";
    this.baseUrl = "https://generativelanguage.googleapis.com";
  }

  async chat(messages, options = {}) {
    const model = options.model || this.defaultModel;

    // Convert to Gemini format
    const contents = [];
    let systemInstruction;

    for (const msg of messages) {
      if (msg.role === "system") {
        systemInstruction = { parts: [{ text: msg.content }] };
        continue;
      }
      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }

    const body = JSON.stringify({
      contents,
      ...(systemInstruction && { systemInstruction }),
    });

    const path = `/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

    return new Promise((resolve, reject) => {
      const req = https.request(
        { hostname: "generativelanguage.googleapis.com", path, method: "POST", headers: { "Content-Type": "application/json" } },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              const parsed = JSON.parse(data);
              if (parsed.error) {
                return reject(new Error(parsed.error.message || JSON.stringify(parsed.error)));
              }
              const text = parsed.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
              resolve(makeResponse(model, text));
            } catch {
              reject(new Error(`Gemini API returned invalid JSON: ${data.slice(0, 200)}`));
            }
          });
        }
      );

      req.on("error", (err) => reject(new Error(`Failed to connect to Gemini API: ${err.message}`)));
      req.write(body);
      req.end();
    });
  }

  chatStream(messages, options = {}) {
    const model = options.model || this.defaultModel;

    const contents = [];
    let systemInstruction;

    for (const msg of messages) {
      if (msg.role === "system") {
        systemInstruction = { parts: [{ text: msg.content }] };
        continue;
      }
      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }

    const body = JSON.stringify({
      contents,
      ...(systemInstruction && { systemInstruction }),
    });

    const path = `/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${this.apiKey}`;
    const emitter = new EventEmitter();

    const req = https.request(
      { hostname: "generativelanguage.googleapis.com", path, method: "POST", headers: { "Content-Type": "application/json" } },
      (res) => {
        let buffer = "";
        res.on("data", (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop();

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(trimmed.slice(6));
              const text = event.candidates?.[0]?.content?.parts?.map((p) => p.text).join("");
              if (text) emitter.emit("data", text);
            } catch { /* ignore partial */ }
          }
        });
        res.on("end", () => emitter.emit("end"));
        res.on("error", (err) => emitter.emit("error", err));
      }
    );

    req.on("error", (err) => emitter.emit("error", err));
    req.write(body);
    req.end();

    return emitter;
  }
}

module.exports = GeminiAPIProvider;
