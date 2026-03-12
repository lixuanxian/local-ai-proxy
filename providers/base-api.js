const http = require("http");
const https = require("https");
const { EventEmitter } = require("events");
const { makeResponse } = require("../lib/utils");

/**
 * Base class for HTTP API-based providers.
 * Subclasses configure: baseUrl, apiKey, endpoint paths, request/response format.
 */
class BaseAPIProvider {
  constructor({
    name,
    baseUrl,
    apiKey,
    chatPath,
    buildBody,
    parseResponse,
    parseStreamChunk,
  }) {
    this.name = name;
    this.baseUrl = baseUrl;
    this.apiKey = apiKey || "";
    this.chatPath = chatPath; // e.g. "/v1/chat/completions"
    // buildBody(messages, model, stream) => object
    this._buildBody = buildBody;
    // parseResponse(data) => { model, content } or full OpenAI response
    this._parseResponse = parseResponse;
    // parseStreamChunk(line) => { text, done } | null
    this._parseStreamChunk = parseStreamChunk;
  }

  _getTransport(url) {
    return url.protocol === "https:" ? https : http;
  }

  async chat(messages, options = {}) {
    const model = options.model;
    const body = JSON.stringify(this._buildBody(messages, model, false));
    const url = new URL(this.chatPath, this.baseUrl);
    const transport = this._getTransport(url);

    return new Promise((resolve, reject) => {
      const headers = { "Content-Type": "application/json" };
      if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;

      const req = transport.request(url, { method: "POST", headers }, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            const result = this._parseResponse(parsed);
            // If parseResponse returns a full response object, use it directly
            if (result.choices) {
              resolve(result);
            } else {
              resolve(makeResponse(result.model || this.name, result.content));
            }
          } catch {
            reject(new Error(`${this.name} returned invalid JSON: ${data.slice(0, 200)}`));
          }
        });
      });

      req.on("error", (err) => {
        reject(new Error(`Failed to connect to ${this.name} at ${this.baseUrl}: ${err.message}`));
      });

      req.write(body);
      req.end();
    });
  }

  chatStream(messages, options = {}) {
    const model = options.model;
    const body = JSON.stringify(this._buildBody(messages, model, true));
    const url = new URL(this.chatPath, this.baseUrl);
    const transport = this._getTransport(url);

    const headers = { "Content-Type": "application/json" };
    if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;

    const emitter = new EventEmitter();

    const req = transport.request(url, { method: "POST", headers });

    req.on("response", (res) => {
      let buffer = "";
      res.on("data", (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop(); // keep incomplete line

        for (const line of lines) {
          const result = this._parseStreamChunk(line.trim());
          if (!result) continue;
          if (result.done) {
            emitter.emit("end");
            return;
          }
          if (result.text) {
            emitter.emit("data", result.text);
          }
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

module.exports = BaseAPIProvider;
