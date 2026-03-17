const { Router } = require("express");
const config = require("../../lib/config");
const { logRequest } = require("../../lib/logger");
const { resolveProvider, anthropicToInternal, buildMessageContent, logMessageAttachments } = require("../../lib/utils");
const { buildContextWindow, compressConversation } = require("../../lib/context");

function estimateMsgTokens(msgs) {
  let chars = 0;
  for (const m of (msgs || [])) {
    if (typeof m.content === "string") chars += m.content.length;
    else if (Array.isArray(m.content)) {
      for (const b of m.content) { if (b.text) chars += b.text.length; }
    }
  }
  return Math.ceil(chars / 4);
}

module.exports = function createAnthropicRouter(providerRegistry) {
  const router = Router();

  // Messages endpoint (Anthropic-compatible)
  router.post("/v1/messages", async (req, res) => {
    try {
      const { model, messages, system, stream, provider: providerName, session_id, tools, tool_choice } = req.body;

      if (!session_id && (!messages || !Array.isArray(messages) || messages.length === 0)) {
        return res.status(400).json({
          type: "error",
          error: {
            type: "invalid_request_error",
            message: "messages is required and must be a non-empty array",
          },
        });
      }

      // Convert Anthropic format to unified format
      const unifiedMessages = [];
      if (system) {
        const systemText =
          typeof system === "string"
            ? system
            : Array.isArray(system)
              ? system.map((b) => b.text || "").join("\n")
              : "";
        if (systemText) unifiedMessages.push({ role: "system", content: systemText });
      }

      for (const msg of (messages || [])) {
        const content = anthropicToInternal(msg.content);
        unifiedMessages.push({ role: msg.role, content });
      }

      const resolved = providerRegistry.resolve(providerName, model);
      const resolvedName = resolved.name;
      const effectiveModel = resolved.modelMatched ? model : undefined;
      let provider;

      // Try DB-configured provider first (supports custom base_url/api_key)
      const rawDbProvider = (resolved.dbProviderId && config.getProvider(resolved.dbProviderId)) || config.getProvider(resolvedName) || config.getDefaultProvider();
      const dbProvider = rawDbProvider && rawDbProvider.enabled ? rawDbProvider : null;
      if (dbProvider && dbProvider.base_url) {
        provider = resolveProvider(dbProvider, providerRegistry);
      }
      // Fallback to built-in registry
      if (!provider) {
        provider = providerRegistry.get(resolvedName);
      }

      if (!provider) {
        return res.status(400).json({
          type: "error",
          error: {
            type: "invalid_request_error",
            message: `Unknown provider: "${resolvedName}". Available: ${providerRegistry.listNames().join(", ")}`,
          },
        });
      }

      // Session support
      let chatMessages = unifiedMessages;
      let sessionInfo = null;

      if (session_id) {
        let conv = config.getConversation(session_id);
        if (!conv) {
          config.saveConversation({ id: session_id, title: "API Session" });
          conv = config.getConversation(session_id);
        }

        // Save the last user message
        if (unifiedMessages.length > 0) {
          const lastUserMsg = [...unifiedMessages].reverse().find(m => m.role === "user");
          if (lastUserMsg) {
            const attachments = req.fileAttachments || null;
            config.saveMessage({
              conversation_id: session_id,
              role: "user",
              content: lastUserMsg.content,
              attachments,
            });
            if (conv.title === "API Session" || conv.title === "New Chat") {
              config.updateConversationTitle(session_id, lastUserMsg.content.slice(0, 40));
            }
          }
        }

        let contextResult = buildContextWindow(session_id, { systemPrompt: conv.system_prompt });

        const isCLI = !!provider.command;
        if (!isCLI && contextResult.contextInfo.compressRecommended && conv.auto_compress) {
          try {
            await compressConversation(session_id, provider, model);
            contextResult = buildContextWindow(session_id, { systemPrompt: conv.system_prompt });
          } catch (err) {
            console.error(`[SESSION] Auto-compress failed for session=${session_id}: ${err.message}`);
          }
        }

        chatMessages = contextResult.messages.map(m => ({
          role: m.role,
          content: m.attachments ? buildMessageContent(m.content, m.attachments) : m.content,
        }));
        sessionInfo = { session_id, ...contextResult.contextInfo };
      }

      console.log(`[${new Date().toISOString()}] (messages API) ${resolvedName} | ${model || "default"} | messages: ${chatMessages.length}${session_id ? ` | session: ${session_id}` : ""}`);
      logMessageAttachments("Anthropic", chatMessages);

      // Streaming (Anthropic SSE format)
      if (stream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        const msgId = `msg_${Date.now()}`;
        const streamStart = Date.now();

        const startEvent = {
          type: "message_start",
          message: {
            id: msgId,
            type: "message",
            role: "assistant",
            content: [],
            model: model || resolvedName,
            stop_reason: null,
            usage: { input_tokens: 0, output_tokens: 0 },
          },
        };
        res.write(`event: message_start\ndata: ${JSON.stringify(startEvent)}\n\n`);
        res.write(`event: content_block_start\ndata: ${JSON.stringify({ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } })}\n\n`);

        try {
          const emitter = provider.chatStream(chatMessages, { model: effectiveModel, session_id, tools, tool_choice });
          let fullResponse = "";

          const onText = (text) => {
            fullResponse += text;
            const delta = {
              type: "content_block_delta",
              index: 0,
              delta: { type: "text_delta", text },
            };
            res.write(`event: content_block_delta\ndata: ${JSON.stringify(delta)}\n\n`);
          };

          const onDone = () => {
            if (session_id && fullResponse) {
              config.saveMessage({ conversation_id: session_id, role: "assistant", content: fullResponse });
            }
            logRequest({
              apiFormat: "anthropic",
              providerId: providerName || resolvedName,
              model: model || null,
              requestBody: { messages: chatMessages.length, model, provider: providerName, stream: true },
              responseBody: { content_length: fullResponse.length },
              statusCode: 200,
              inputTokens: estimateMsgTokens(chatMessages),
              outputTokens: Math.ceil(fullResponse.length / 4),
              latencyMs: Date.now() - streamStart,
            });
            res.write(`event: content_block_stop\ndata: ${JSON.stringify({ type: "content_block_stop", index: 0 })}\n\n`);
            res.write(`event: message_delta\ndata: ${JSON.stringify({ type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 0 } })}\n\n`);
            res.write(`event: message_stop\ndata: ${JSON.stringify({ type: "message_stop" })}\n\n`);
            res.end();
          };

          const onError = (err) => {
            if (session_id && fullResponse) {
              config.saveMessage({ conversation_id: session_id, role: "assistant", content: fullResponse });
            }
            logRequest({
              apiFormat: "anthropic",
              providerId: providerName || resolvedName,
              model: model || null,
              requestBody: { messages: chatMessages.length, model, provider: providerName, stream: true },
              statusCode: 500,
              latencyMs: Date.now() - streamStart,
              error: err.message,
            });
            res.write(`event: error\ndata: ${JSON.stringify({ type: "error", error: { message: err.message } })}\n\n`);
            res.end();
          };

          if (emitter.stdout) {
            emitter.stdout.on("data", (chunk) => onText(chunk.toString()));
            emitter.on("close", onDone);
            emitter.on("error", onError);
          } else {
            emitter.on("data", onText);
            emitter.on("end", onDone);
            emitter.on("error", onError);
          }
        } catch (err) {
          res.write(`event: error\ndata: ${JSON.stringify({ type: "error", error: { message: err.message } })}\n\n`);
          res.end();
        }
        return;
      }

      // Non-streaming
      const result = await provider.chat(chatMessages, { model: effectiveModel, session_id, tools, tool_choice });
      const content = result.choices?.[0]?.message?.content || "";

      if (session_id && content) {
        config.saveMessage({ conversation_id: session_id, role: "assistant", content });
      }

      const response = {
        id: `msg_${Date.now()}`,
        type: "message",
        role: "assistant",
        content: [{ type: "text", text: content }],
        model: model || resolvedName,
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: {
          input_tokens: result.usage?.prompt_tokens || 0,
          output_tokens: result.usage?.completion_tokens || 0,
        },
      };

      if (sessionInfo) response.session = sessionInfo;

      res.json(response);
    } catch (err) {
      console.error(`[ERROR] ${err.message}`);
      res.status(500).json({
        type: "error",
        error: { type: "api_error", message: err.message },
      });
    }
  });

  return router;
};
