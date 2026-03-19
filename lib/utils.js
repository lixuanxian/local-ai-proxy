// Shared utility functions for providers
const path = require("path");
const fs = require("fs");
const { getUploadsDir } = require('./paths');

const UPLOADS_DIR = getUploadsDir();

/**
 * Extract text from a message content field (string or multimodal array).
 * For image parts, includes the filename when available via _name metadata.
 */
function extractText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return String(content);
  return content
    .map((part) => {
      if (part.type === "text") return part.text;
      if (part.type === "image_url" || part.type === "image") {
        const name = part._name || "image";
        return `[Image: ${name}]`;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

/**
 * Build multimodal message content from text + attachments.
 * Returns a string (text-only) or array (multimodal) for OpenAI-compatible APIs.
 * Image parts include _name and _filePath metadata for CLI provider fallback.
 */
function buildMessageContent(text, attachments) {
  if (!attachments || attachments.length === 0) return text;
  const parsed = typeof attachments === "string" ? JSON.parse(attachments) : attachments;
  if (!parsed || parsed.length === 0) return text;

  const parts = [];
  if (text) parts.push({ type: "text", text });

  for (const att of parsed) {
    if (att.mimetype && att.mimetype.startsWith("image/")) {
      const filename = att.url ? att.url.replace(/^\/uploads\//, "") : att.id;
      const filePath = path.join(UPLOADS_DIR, filename);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const base64 = fs.readFileSync(filePath).toString("base64");
        console.log(`[ATTACH] image: ${att.name} (${att.mimetype}, ${(stats.size / 1024).toFixed(1)}KB, base64=${(base64.length / 1024).toFixed(1)}KB)`);
        parts.push({
          type: "image_url",
          image_url: { url: `data:${att.mimetype};base64,${base64}` },
          _name: att.name,
          _filePath: filePath,
        });
      } else {
        console.log(`[ATTACH] image MISSING: ${att.name} -> ${filePath}`);
      }
    } else if (att.mimetype && att.mimetype.startsWith("text/")) {
      const filename = att.url ? att.url.replace(/^\/uploads\//, "") : att.id;
      const filePath = path.join(UPLOADS_DIR, filename);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        console.log(`[ATTACH] text: ${att.name} (${att.mimetype}, ${content.length} chars)`);
        parts.push({ type: "text", text: `[File: ${att.name}]\n${content}` });
      } else {
        console.log(`[ATTACH] text MISSING: ${att.name} -> ${filePath}`);
      }
    } else if (att.mimetype && att.mimetype === "application/pdf") {
      const filename = att.url ? att.url.replace(/^\/uploads\//, "") : att.id;
      const filePath = path.join(UPLOADS_DIR, filename);
      if (fs.existsSync(filePath)) {
        console.log(`[ATTACH] pdf: ${att.name} (not inlined)`);
        parts.push({ type: "text", text: `[PDF file: ${att.name} — binary content cannot be included as text]` });
      } else {
        console.log(`[ATTACH] pdf MISSING: ${att.name} -> ${filePath}`);
      }
    } else {
      console.log(`[ATTACH] other: ${att.name} (${att.mimetype || "unknown"})`);
      parts.push({ type: "text", text: `[Attached file: ${att.name} (${att.mimetype || "unknown type"})]` });
    }
  }

  return parts.length === 1 && parts[0].type === "text" ? parts[0].text : parts;
}

/**
 * Log a summary of multimodal content in a messages array.
 * Call before sending to provider to confirm attachments are included.
 */
function logMessageAttachments(tag, messages) {
  let images = 0, textFiles = 0, multimodal = 0;
  for (const m of messages) {
    if (Array.isArray(m.content)) {
      multimodal++;
      for (const part of m.content) {
        if (part.type === "image_url" || part.type === "image") images++;
        if (part.type === "text" && part.text?.startsWith("[File:")) textFiles++;
      }
    }
  }
  if (images || textFiles) {
    console.log(`[${tag}] sending ${messages.length} messages (${multimodal} multimodal, ${images} images, ${textFiles} files)`);
  }
}

/**
 * Convert unified message array to a prompt string for CLI providers.
 * CLI providers are single-turn, so only include:
 *   - System prompt (if any)
 *   - The last user message
 * This avoids sending full conversation history which causes CLIs to
 * repeat or reference old assistant responses.
 */
function formatMessages(messages) {
  const parts = [];

  // Include system messages (instructions/context)
  for (const m of messages) {
    if (m.role === "system") {
      parts.push(`[System]: ${extractText(m.content)}`);
    }
  }

  // Only include the last user message
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      parts.push(extractText(messages[i].content));
      break;
    }
  }

  return parts.join("\n\n");
}

/**
 * Convert full message array to a prompt string for CLI providers with session support.
 * Includes all messages with role labels to preserve conversation context.
 * Used when CLI doesn't support native sessions and needs full context each call.
 */
function formatAllMessages(messages) {
  const parts = [];
  for (const m of messages) {
    const text = extractText(m.content);
    if (!text) continue;
    if (m.role === "system") {
      parts.push(`[System]: ${text}`);
    } else if (m.role === "assistant") {
      parts.push(`[Assistant]: ${text}`);
    } else {
      parts.push(`[User]: ${text}`);
    }
  }
  return parts.join("\n\n");
}

/**
 * Parse a data URI (data:mime;base64,...) into { mimeType, data }.
 * Returns null if not a valid data URI.
 */
function parseDataUri(url) {
  const match = url?.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

/**
 * Convert messages to Anthropic Messages API format.
 * Transforms OpenAI-style image_url blocks to Anthropic image blocks.
 */
function toAnthropicMessages(messages) {
  return messages.map((m) => {
    if (typeof m.content === "string") return m;
    if (!Array.isArray(m.content)) return { ...m, content: String(m.content) };

    const blocks = m.content.map((part) => {
      if (part.type === "text") return part;
      if (part.type === "image_url") {
        const parsed = parseDataUri(part.image_url?.url);
        if (parsed) {
          return {
            type: "image",
            source: { type: "base64", media_type: parsed.mimeType, data: parsed.data },
          };
        }
        // URL-based image — pass as-is (Anthropic supports url source)
        return {
          type: "image",
          source: { type: "url", url: part.image_url?.url },
        };
      }
      // Already Anthropic format
      if (part.type === "image") return part;
      return part;
    });

    return { ...m, content: blocks };
  });
}

/**
 * Convert messages to Gemini API format (contents array with parts).
 * Returns { contents, systemInstruction }.
 */
function toGeminiContents(messages) {
  const contents = [];
  let systemInstruction;

  for (const msg of messages) {
    if (msg.role === "system") {
      systemInstruction = { parts: [{ text: extractText(msg.content) }] };
      continue;
    }

    const parts = [];
    const content = msg.content;

    if (typeof content === "string") {
      parts.push({ text: content });
    } else if (Array.isArray(content)) {
      for (const part of content) {
        if (part.type === "text") {
          parts.push({ text: part.text });
        } else if (part.type === "image_url") {
          const parsed = parseDataUri(part.image_url?.url);
          if (parsed) {
            parts.push({ inlineData: { mimeType: parsed.mimeType, data: parsed.data } });
          }
        } else if (part.type === "image") {
          // Anthropic format image
          if (part.source?.type === "base64") {
            parts.push({ inlineData: { mimeType: part.source.media_type, data: part.source.data } });
          }
        }
      }
    } else {
      parts.push({ text: String(content) });
    }

    if (parts.length > 0) {
      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts,
      });
    }
  }

  return { contents, systemInstruction };
}

/**
 * Normalize incoming Anthropic-format content blocks to OpenAI-style internal format.
 * Used by the Anthropic router to preserve images instead of stripping them.
 */
function anthropicToInternal(contentBlocks) {
  if (typeof contentBlocks === "string") return contentBlocks;
  if (!Array.isArray(contentBlocks)) return String(contentBlocks);

  const parts = contentBlocks.map((block) => {
    if (block.type === "text") return { type: "text", text: block.text };
    if (block.type === "image") {
      if (block.source?.type === "base64") {
        return {
          type: "image_url",
          image_url: { url: `data:${block.source.media_type};base64,${block.source.data}` },
        };
      }
      if (block.source?.type === "url") {
        return { type: "image_url", image_url: { url: block.source.url } };
      }
    }
    return { type: "text", text: JSON.stringify(block) };
  });

  // If only text parts, return as string
  const hasNonText = parts.some((p) => p.type !== "text");
  if (!hasNonText) return parts.map((p) => p.text).join("\n");
  return parts;
}

/**
 * Create an OpenAI-compatible chat completion response object
 */
function makeResponse(model, content) {
  return {
    id: `chatcmpl-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

/**
 * Resolve a provider instance from DB config.
 * For API types, creates a fresh instance with provider-specific base_url/api_key.
 * For CLI types, looks up the singleton in the registry.
 */
function resolveProvider(providerConfig, providerRegistry) {
  if (!providerConfig) return null;

  const { idToName } = require("./provider-registry");

  if (providerConfig.type === "anthropic-api" && providerConfig.base_url) {
    const ClaudeCompatProvider = require("../providers/claude-compat");
    return new ClaudeCompatProvider({
      name: providerConfig.name || providerConfig.id,
      baseUrl: providerConfig.base_url,
      apiKey: providerConfig.api_key || "",
      defaultModel: providerConfig.default_model,
    });
  }

  if (providerConfig.type === "openai-api" && providerConfig.base_url) {
    const BaseAPIProvider = require("../providers/base-api");
    return new BaseAPIProvider({
      name: providerConfig.name || providerConfig.id,
      baseUrl: providerConfig.base_url,
      apiKey: providerConfig.api_key || "",
      chatPath: "/v1/chat/completions",
      buildBody(messages, model, stream, options = {}) {
        const effectiveModel = (model && model !== 'auto') ? model : (providerConfig.default_model || "gpt-4");
        const body = { model: effectiveModel, messages, stream };
        if (options.tools && options.tools.length > 0) {
          body.tools = options.tools;
          if (options.tool_choice) body.tool_choice = options.tool_choice;
        }
        return body;
      },
      parseResponse(data) { return data; },
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
  }

  // Claude CLI type: look up singleton in registry
  if (providerConfig.type === "claude-cli" || providerConfig.id === "claude-cli") {
    return providerRegistry.get("claude-cli") || null;
  }

  // CLI and other types: look up in registry
  const typeMap = {
    'claude-cli': 'claude', 'copilot-cli': 'copilot', 'codex-cli': 'codex',
    'gemini-cli': 'gemini',
    'gemini-api': 'gemini',
  };

  return providerRegistry.get(providerConfig.id)
    || providerRegistry.get(idToName[providerConfig.id])
    || providerRegistry.get(typeMap[providerConfig.type])
    || providerRegistry.get(providerConfig.name?.toLowerCase())
    || null;
}

/**
 * Convert MCP tool definition to OpenAI function-calling format.
 */
function mcpToolToOpenAI(mcpTool) {
  return {
    type: "function",
    function: {
      name: mcpTool.name,
      description: mcpTool.description || "",
      parameters: mcpTool.inputSchema || { type: "object", properties: {} },
    },
  };
}

/**
 * Convert MCP tool definition to Anthropic tool_use format.
 */
function mcpToolToAnthropic(mcpTool) {
  return {
    name: mcpTool.name,
    description: mcpTool.description || "",
    input_schema: mcpTool.inputSchema || { type: "object", properties: {} },
  };
}

/**
 * Normalize Claude model names: replace dots with dashes in the version number.
 * e.g. "claude-sonnet-4.6" → "claude-sonnet-4-6"
 */
function normalizeClaudeModel(model) {
  if (!model || !model.startsWith("claude-")) return model;
  return model.replace(/\./g, "-");
}

module.exports = {
  formatMessages, formatAllMessages, makeResponse, resolveProvider, extractText,
  parseDataUri, toAnthropicMessages, toGeminiContents, anthropicToInternal,
  buildMessageContent, logMessageAttachments,
  mcpToolToOpenAI, mcpToolToAnthropic,
  normalizeClaudeModel,
};
