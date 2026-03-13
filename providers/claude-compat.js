const http = require("http");
const https = require("https");
const { EventEmitter } = require("events");
const { makeResponse, toAnthropicMessages } = require("../lib/utils");

/**
 * Generic Anthropic-compatible API provider.
 * Connects to any API that implements the Anthropic Messages format.
 */
class ClaudeCompatProvider {
  constructor({ name, baseUrl, apiKey, defaultModel }) {
    this.name = name || "claude-api";
    this.baseUrl = baseUrl;
    this.apiKey = apiKey || "";
    this.defaultModel = defaultModel || "claude-sonnet-4-20250514";
  }

  _getTransport(url) {
    return url.protocol === "https:" ? https : http;
  }

  _buildUrl(path) {
    const base = this.baseUrl.replace(/\/+$/, "");
    const baseObj = new URL(base);
    const basePath = baseObj.pathname.replace(/\/+$/, "");
    if (basePath !== "" && path.startsWith(basePath)) {
      return new URL(`${baseObj.origin}${path}`);
    }
    return new URL(`${base}${path}`);
  }

  async chat(messages, options = {}) {
    const model = (options.model && options.model !== 'auto') ? options.model : this.defaultModel;

    // Convert multimodal content to Anthropic format
    const converted = toAnthropicMessages(messages);
    const systemMsgs = converted.filter((m) => m.role === "system");
    const nonSystemMsgs = converted.filter((m) => m.role !== "system");
    const systemText = systemMsgs.map((m) => typeof m.content === "string" ? m.content : "").join("\n") || undefined;

    const body = JSON.stringify({
      model,
      system: systemText,
      messages: nonSystemMsgs,
      max_tokens: 4096,
      stream: false,
    });

    const url = this._buildUrl("/v1/messages");
    const transport = this._getTransport(url);

    console.log(`[API:${this.name}] POST ${url.href} model=${model}`);

    return new Promise((resolve, reject) => {
      const headers = {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
      };
      if (this.apiKey) headers["x-api-key"] = this.apiKey;

      const req = transport.request(url, { method: "POST", headers }, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          console.log(`[API:${this.name}] status=${res.statusCode}, body=${data.slice(0, 300)}`);
          if (res.statusCode >= 400) {
            return reject(new Error(`Anthropic API returned HTTP ${res.statusCode}: ${data.slice(0, 300)}`));
          }
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              return reject(new Error(parsed.error.message || JSON.stringify(parsed.error)));
            }
            const content = parsed.content?.map((b) => b.text || "").join("\n") || "";
            resolve(makeResponse(model, content));
          } catch {
            reject(new Error(`Anthropic API returned invalid JSON: ${data.slice(0, 200)}`));
          }
        });
      });

      req.on("error", (err) => {
        reject(new Error(`Failed to connect to Anthropic API at ${this.baseUrl}: ${err.message}`));
      });

      req.write(body);
      req.end();
    });
  }

  chatStream(messages, options = {}) {
    const model = (options.model && options.model !== 'auto') ? options.model : this.defaultModel;

    // Convert multimodal content to Anthropic format
    const converted = toAnthropicMessages(messages);
    const systemMsgs = converted.filter((m) => m.role === "system");
    const nonSystemMsgs = converted.filter((m) => m.role !== "system");
    const systemText = systemMsgs.map((m) => typeof m.content === "string" ? m.content : "").join("\n") || undefined;

    const body = JSON.stringify({
      model,
      system: systemText,
      messages: nonSystemMsgs,
      max_tokens: 4096,
      stream: true,
    });

    const url = this._buildUrl("/v1/messages");
    const transport = this._getTransport(url);

    console.log(`[API:${this.name}] stream POST ${url.href} model=${model}`);

    const headers = {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
    };
    if (this.apiKey) headers["x-api-key"] = this.apiKey;

    const emitter = new EventEmitter();
    const req = transport.request(url, { method: "POST", headers });

    req.on("response", (res) => {
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
            if (event.type === "content_block_delta" && event.delta?.text) {
              emitter.emit("data", event.delta.text);
            } else if (event.type === "message_stop") {
              emitter.emit("end");
            }
          } catch { /* ignore partial */ }
        }
      });
      res.on("end", () => emitter.emit("end"));
      res.on("error", (err) => emitter.emit("error", err));
    });

    req.on("error", (err) => emitter.emit("error", err));
    req.write(body);
    req.end();

    return emitter;
  }
}

module.exports = ClaudeCompatProvider;
