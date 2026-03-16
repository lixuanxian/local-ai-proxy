const { Router } = require("express");
const config = require("../../lib/config");
const { logRequest } = require("../../lib/logger");
const { resolveProvider, buildMessageContent, logMessageAttachments } = require("../../lib/utils");
const { buildContextWindow, compressConversation } = require("../../lib/context");

module.exports = function createOpenAIRouter(providerRegistry) {
  const router = Router();

  // List models (OpenAI-compatible)
  router.get("/v1/models", (req, res) => {
    // Return model mappings if available, otherwise fall back to provider names
    const mappings = config.getAllModelMappings();
    if (mappings.length > 0) {
      // Deduplicate by model_name — one entry per unique model
      const seen = new Set();
      const models = [];
      for (const m of mappings) {
        if (seen.has(m.model_name)) continue;
        seen.add(m.model_name);
        models.push({
          id: m.model_name,
          object: "model",
          owned_by: m.provider_name || m.provider_id,
        });
      }
      return res.json({ object: "list", data: models });
    }

    // Fallback: list provider names as models
    const names = providerRegistry.listNames();
    res.json({
      object: "list",
      data: names.map((name) => ({
        id: name,
        object: "model",
        owned_by: name,
      })),
    });
  });

  // Chat completions (OpenAI-compatible)
  router.post("/v1/chat/completions", async (req, res) => {
    try {
      const { messages, provider: providerName, model, stream, session_id, tools, tool_choice } = req.body;

      if (!session_id && (!messages || !Array.isArray(messages) || messages.length === 0)) {
        return res.status(400).json({
          error: {
            message: "messages is required and must be a non-empty array",
            type: "invalid_request_error",
          },
        });
      }

      const resolved = providerRegistry.resolve(providerName, model);
      const resolvedName = resolved.name;
      // If model wasn't matched by any provider's patterns, don't pass it downstream
      // (especially important for CLI providers that would get an unsupported --model flag)
      const effectiveModel = resolved.modelMatched ? model : undefined;
      let provider;

      // Try DB-configured provider first (supports custom base_url/api_key)
      const rawDbProvider = config.getProvider(resolvedName) || config.getDefaultProvider();
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
          error: {
            message: `Unknown provider: "${resolvedName}". Available: ${providerRegistry.listNames().join(", ")}`,
            type: "invalid_request_error",
          },
        });
      }

      // Session support: if session_id provided, use conversation-based context
      let chatMessages = messages || [];
      let sessionInfo = null;

      if (session_id) {
        // Ensure conversation exists
        let conv = config.getConversation(session_id);
        if (!conv) {
          config.saveConversation({ id: session_id, title: "API Session" });
          conv = config.getConversation(session_id);
        }

        // Save the last user message from the request
        if (messages && messages.length > 0) {
          const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
          if (lastUserMsg) {
            const content = typeof lastUserMsg.content === "string" ? lastUserMsg.content : JSON.stringify(lastUserMsg.content);
            // Handle file attachments from multipart upload
            const attachments = req.fileAttachments || null;
            config.saveMessage({
              conversation_id: session_id,
              role: "user",
              content,
              attachments,
            });
            // Auto-title from first message
            if (conv.title === "API Session" || conv.title === "New Chat") {
              config.updateConversationTitle(session_id, content.slice(0, 40));
            }
          }
        }

        // Build context from stored conversation
        let contextResult = buildContextWindow(session_id, {
          systemPrompt: conv.system_prompt,
        });

        // Auto-compress if recommended (skip for CLI providers)
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

      console.log(`[${new Date().toISOString()}] ${resolvedName} | ${model || "default"} | messages: ${chatMessages.length}${session_id ? ` | session: ${session_id}` : ""}`);
      logMessageAttachments("OpenAI", chatMessages);

      // Streaming
      if (stream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        let fullResponse = "";
        const streamStart = Date.now();

        try {
          const emitter = provider.chatStream(chatMessages, { model: effectiveModel, session_id, tools, tool_choice });

          const onText = (text) => {
            fullResponse += text;
            const sseData = {
              id: `chatcmpl-${Date.now()}`,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model: model || resolvedName,
              choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
            };
            res.write(`data: ${JSON.stringify(sseData)}\n\n`);
          };

          const onDone = () => {
            // Save assistant response to session
            if (session_id && fullResponse) {
              config.saveMessage({
                conversation_id: session_id,
                role: "assistant",
                content: fullResponse,
              });
            }
            logRequest({
              apiFormat: "openai",
              providerId: providerName || resolvedName,
              model: model || null,
              requestBody: { messages: chatMessages.length, model, provider: providerName, stream: true },
              responseBody: { content_length: fullResponse.length },
              statusCode: 200,
              inputTokens: estimateMsgTokens(chatMessages),
              outputTokens: Math.ceil(fullResponse.length / 4),
              latencyMs: Date.now() - streamStart,
            });
            res.write("data: [DONE]\n\n");
            res.end();
          };

          const onError = (err) => {
            if (session_id && fullResponse) {
              config.saveMessage({ conversation_id: session_id, role: "assistant", content: fullResponse });
            }
            logRequest({
              apiFormat: "openai",
              providerId: providerName || resolvedName,
              model: model || null,
              requestBody: { messages: chatMessages.length, model, provider: providerName, stream: true },
              statusCode: 500,
              latencyMs: Date.now() - streamStart,
              error: err.message,
            });
            res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
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
          res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
          res.end();
        }
        return;
      }

      // Non-streaming
      const result = await provider.chat(chatMessages, { model: effectiveModel, session_id, tools, tool_choice });

      // Save assistant response to session
      if (session_id) {
        const assistantContent = result?.choices?.[0]?.message?.content || "";
        if (assistantContent) {
          config.saveMessage({
            conversation_id: session_id,
            role: "assistant",
            content: assistantContent,
          });
        }
      }

      // Include session info in response
      if (sessionInfo) {
        result.session = sessionInfo;
      }

      res.json(result);
    } catch (err) {
      console.error(`[ERROR] ${err.message}`);
      res.status(500).json({
        error: { message: err.message, type: "server_error" },
      });
    }
  });

  return router;
};
