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

  _buildUrl(path) {
    const base = this.baseUrl.replace(/\/+$/, "");
    // If baseUrl path and endpoint path overlap (e.g. base="/v1", path="/v1/chat/completions"),
    // strip the overlapping prefix to avoid duplication like "/v1/v1/chat/completions"
    const baseObj = new URL(base);
    const basePath = baseObj.pathname.replace(/\/+$/, "");
    if (basePath !== "" && path.startsWith(basePath)) {
      return new URL(`${baseObj.origin}${path}`);
    }
    return new URL(`${base}${path}`);
  }

  async chat(messages, options = {}) {
    const model = (options.model && options.model !== 'auto') ? options.model : undefined;
    const body = JSON.stringify(this._buildBody(messages, model, false, options));
    const url = this._buildUrl(this.chatPath);
    const transport = this._getTransport(url);

    console.log(`[API:${this.name}] POST ${url.href} model=${model}`);

    return new Promise((resolve, reject) => {
      const headers = { "Content-Type": "application/json" };
      if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;

      const req = transport.request(url, { method: "POST", headers }, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          console.log(`[API:${this.name}] status=${res.statusCode}, body=${data.slice(0, 300)}`);
          if (res.statusCode >= 400) {
            return reject(new Error(`${this.name} returned HTTP ${res.statusCode}: ${data.slice(0, 300)}`));
          }
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
    const model = (options.model && options.model !== 'auto') ? options.model : undefined;
    const body = JSON.stringify(this._buildBody(messages, model, true, options));
    const url = this._buildUrl(this.chatPath);
    const transport = this._getTransport(url);

    console.log(`[API:${this.name}] stream POST ${url.href} model=${model}`);

    const headers = { "Content-Type": "application/json" };
    if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;

    const emitter = new EventEmitter();
    let ended = false;

    const emitEnd = () => {
      if (ended) return;
      ended = true;
      emitter.emit("end");
    };

    const req = transport.request(url, { method: "POST", headers });

    req.on("response", (res) => {
      // Handle HTTP errors
      if (res.statusCode >= 400) {
        let errBody = "";
        res.on("data", (chunk) => (errBody += chunk));
        res.on("end", () => {
          console.error(`[API:${this.name}] stream error status=${res.statusCode}, body=${errBody.slice(0, 300)}`);
          emitter.emit("error", new Error(`${this.name} returned HTTP ${res.statusCode}: ${errBody.slice(0, 300)}`));
        });
        return;
      }

      let buffer = "";
      res.on("data", (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop(); // keep incomplete line

        for (const line of lines) {
          const result = this._parseStreamChunk(line.trim());
          if (!result) continue;
          if (result.done) {
            emitEnd();
            return;
          }
          if (result.text) {
            emitter.emit("data", result.text);
          }
        }
      });
      res.on("end", () => emitEnd());
      res.on("error", (err) => emitter.emit("error", err));
    });

    req.on("error", (err) => emitter.emit("error", err));
    req.write(body);
    req.end();

    return emitter;
  }
}

module.exports = BaseAPIProvider;
