const http = require("http");
const https = require("https");
const { EventEmitter } = require("events");
const { makeResponse, toAnthropicMessages, normalizeClaudeModel } = require("../lib/utils");

/**
 * Convert tools to Anthropic format if they are in OpenAI format.
 * OpenAI: { type: "function", function: { name, description, parameters } }
 * Anthropic: { name, description, input_schema }
 */
/**
 * Convert tool_choice to Anthropic format if it's in OpenAI format.
 * OpenAI: "auto" | "none" | "required" | { type: "function", function: { name } }
 * Anthropic: { type: "auto" } | { type: "any" } | { type: "tool", name }
 */
function toAnthropicToolChoice(tc) {
  if (!tc) return tc;
  if (typeof tc === "string") {
    if (tc === "auto") return { type: "auto" };
    if (tc === "none") return undefined; // Anthropic: just omit tools
    if (tc === "required") return { type: "any" };
    return { type: "auto" };
  }
  // Already Anthropic format
  if (tc.type === "auto" || tc.type === "any" || tc.type === "tool") return tc;
  // OpenAI specific function choice
  if (tc.type === "function" && tc.function?.name) {
    return { type: "tool", name: tc.function.name };
  }
  return tc;
}

function toAnthropicTools(tools) {
  if (!tools || !tools.length) return tools;
  return tools.map((t) => {
    // Already Anthropic format (has name at top level)
    if (t.name && !t.function) return t;
    // OpenAI format → convert
    if (t.type === "function" && t.function) {
      return {
        name: t.function.name,
        description: t.function.description || "",
        input_schema: t.function.parameters || { type: "object", properties: {} },
      };
    }
    return t;
  });
}

/**
 * Convert OpenAI-format tool call messages to Anthropic format.
 * OpenAI assistant message: { role: "assistant", tool_calls: [{id, type, function: {name, arguments}}] }
 * OpenAI tool result: { role: "tool", tool_call_id, content }
 * Anthropic assistant: { role: "assistant", content: [{type: "tool_use", id, name, input}] }
 * Anthropic tool result: { role: "user", content: [{type: "tool_result", tool_use_id, content}] }
 */
function convertToolMessages(messages) {
  const result = [];
  for (const m of messages) {
    if (m.role === "assistant" && m.tool_calls) {
      const content = [];
      if (m.content) content.push({ type: "text", text: m.content });
      for (const tc of m.tool_calls) {
        let input = {};
        try { input = JSON.parse(tc.function.arguments); } catch {}
        content.push({ type: "tool_use", id: tc.id, name: tc.function.name, input });
      }
      result.push({ role: "assistant", content });
    } else if (m.role === "tool") {
      // Merge consecutive tool results into one user message
      const last = result[result.length - 1];
      const block = { type: "tool_result", tool_use_id: m.tool_call_id, content: m.content || "" };
      if (last && last._toolResult) {
        last.content.push(block);
      } else {
        result.push({ role: "user", content: [block], _toolResult: true });
      }
    } else {
      result.push(m);
    }
  }
  // Clean up internal markers
  for (const m of result) delete m._toolResult;
  return result;
}

/**
 * Generic Anthropic-compatible API provider.
 * Connects to any API that implements the Anthropic Messages format.
 */
class ClaudeCompatProvider {
  constructor({ name, baseUrl, apiKey, defaultModel }) {
    this.name = name || "claude-api";
    this.baseUrl = baseUrl;
    this.apiKey = apiKey || "";
    this.defaultModel = defaultModel || "claude-sonnet-4-6";
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
    const model = normalizeClaudeModel((options.model && options.model !== 'auto') ? options.model : this.defaultModel);

    // Convert messages to Anthropic format (multimodal + tool calls)
    const converted = convertToolMessages(toAnthropicMessages(messages));
    const systemMsgs = converted.filter((m) => m.role === "system");
    const nonSystemMsgs = converted.filter((m) => m.role !== "system");
    const systemText = systemMsgs.map((m) => typeof m.content === "string" ? m.content : "").join("\n") || undefined;

    const reqBody = {
      model,
      system: systemText,
      messages: nonSystemMsgs,
      max_tokens: options.max_tokens || 4096,
      stream: false,
    };
    if (options.tools && options.tools.length > 0) {
      reqBody.tools = toAnthropicTools(options.tools);
      if (options.tool_choice) reqBody.tool_choice = toAnthropicToolChoice(options.tool_choice);
    }
    const body = JSON.stringify(reqBody);

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
            // Check for tool_use blocks in response
            const toolUseBlocks = parsed.content?.filter((b) => b.type === "tool_use") || [];
            if (toolUseBlocks.length > 0) {
              const textContent = parsed.content.filter((b) => b.type === "text").map((b) => b.text).join("\n") || null;
              resolve({
                id: `chatcmpl-${Date.now()}`,
                object: "chat.completion",
                created: Math.floor(Date.now() / 1000),
                model,
                choices: [{
                  index: 0,
                  message: {
                    role: "assistant",
                    content: textContent,
                    tool_calls: toolUseBlocks.map((b) => ({
                      id: b.id,
                      type: "function",
                      function: { name: b.name, arguments: JSON.stringify(b.input) },
                    })),
                  },
                  finish_reason: "tool_calls",
                }],
                usage: parsed.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
              });
            } else {
              // Extract text from content blocks; fall back to thinking content if no text
              const textBlocks = parsed.content?.filter((b) => b.type === "text" || b.text) || [];
              let content = textBlocks.map((b) => b.text || "").join("\n");
              if (!content) {
                // Fallback: use thinking content if no text blocks present
                const thinkingBlocks = parsed.content?.filter((b) => b.type === "thinking" || b.thinking) || [];
                content = thinkingBlocks.map((b) => b.thinking || "").join("\n");
              }
              resolve(makeResponse(model, content));
            }
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
    const model = normalizeClaudeModel((options.model && options.model !== 'auto') ? options.model : this.defaultModel);

    // Convert messages to Anthropic format (multimodal + tool calls)
    const converted = convertToolMessages(toAnthropicMessages(messages));
    const systemMsgs = converted.filter((m) => m.role === "system");
    const nonSystemMsgs = converted.filter((m) => m.role !== "system");
    const systemText = systemMsgs.map((m) => typeof m.content === "string" ? m.content : "").join("\n") || undefined;

    const streamBody = {
      model,
      system: systemText,
      messages: nonSystemMsgs,
      max_tokens: options.max_tokens || 4096,
      stream: true,
    };
    if (options.tools && options.tools.length > 0) {
      streamBody.tools = toAnthropicTools(options.tools);
      if (options.tool_choice) streamBody.tool_choice = toAnthropicToolChoice(options.tool_choice);
    }
    const body = JSON.stringify(streamBody);

    const url = this._buildUrl("/v1/messages");
    const transport = this._getTransport(url);

    console.log(`[API:${this.name}] stream POST ${url.href} model=${model}`);
    console.log(`[API:${this.name}] stream tools: ${JSON.stringify(streamBody.tools?.map(t => t.name || t.function?.name) || 'none')}`);
    console.log(`[API:${this.name}] stream messages: ${JSON.stringify(nonSystemMsgs.map(m => ({ role: m.role, contentType: typeof m.content, isArray: Array.isArray(m.content), len: typeof m.content === 'string' ? m.content.length : JSON.stringify(m.content).length })))}`);
    console.log(`[API:${this.name}] stream tool_choice: ${JSON.stringify(streamBody.tool_choice || 'none')}`);
    console.log(`[API:${this.name}] stream system len: ${systemText?.length || 0}, max_tokens: ${streamBody.max_tokens}`);

    const headers = {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
    };
    if (this.apiKey) headers["x-api-key"] = this.apiKey;

    const emitter = new EventEmitter();
    const req = transport.request(url, { method: "POST", headers });
    let ended = false;

    const emitEnd = () => {
      if (ended) return;
      ended = true;
      emitter.emit("end");
    };

    req.on("response", (res) => {
      // Handle HTTP errors: read full body and emit as error
      if (res.statusCode >= 400) {
        let errBody = "";
        res.on("data", (chunk) => (errBody += chunk));
        res.on("end", () => {
          console.error(`[API:${this.name}] stream error status=${res.statusCode}, body=${errBody.slice(0, 300)}`);
          emitter.emit("error", new Error(`Anthropic API returned HTTP ${res.statusCode}: ${errBody.slice(0, 300)}`));
        });
        return;
      }

      let buffer = "";
      let firstChunk = true;
      res.on("data", (chunk) => {
        const text = chunk.toString();
        if (firstChunk) {
          console.log(`[API:${this.name}] stream first chunk (${text.length} bytes): ${text.slice(0, 200)}`);
          firstChunk = false;
        }
        buffer += text;
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(trimmed.slice(6));
            if (event.type === "content_block_delta" && event.delta?.text) {
              emitter.emit("data", event.delta.text);
            } else if (event.type === "content_block_delta" && event.delta?.type === "thinking_delta" && event.delta?.thinking) {
              // Emit thinking content as data so it's not silently lost
              emitter.emit("data", event.delta.thinking);
            } else if (event.type === "content_block_start" && event.content_block?.type === "tool_use") {
              emitter.emit("tool_use_start", {
                index: event.index,
                id: event.content_block.id,
                name: event.content_block.name,
              });
            } else if (event.type === "content_block_delta" && event.delta?.type === "input_json_delta") {
              emitter.emit("tool_use_delta", {
                index: event.index,
                partial_json: event.delta.partial_json,
              });
            } else if (event.type === "message_stop") {
              emitEnd();
            }
          } catch { /* ignore partial */ }
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

module.exports = ClaudeCompatProvider;
