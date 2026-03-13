const { Router } = require("express");
const config = require("../../lib/config");
const { resolveProvider, buildMessageContent, logMessageAttachments } = require("../../lib/utils");
const { buildContextWindow, compressConversation } = require("../../lib/context");

module.exports = function createOpenAIRouter(providerRegistry) {
  const router = Router();

  // List models (OpenAI-compatible)
  router.get("/v1/models", (req, res) => {
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
      const { messages, provider: providerName, model, stream, session_id } = req.body;

      if (!session_id && (!messages || !Array.isArray(messages) || messages.length === 0)) {
        return res.status(400).json({
          error: {
            message: "messages is required and must be a non-empty array",
            type: "invalid_request_error",
          },
        });
      }

      const resolvedName = providerRegistry.resolve(providerName, model);
      let provider;

      // Try DB-configured provider first (supports custom base_url/api_key)
      const dbProvider = config.getProvider(resolvedName) || config.getDefaultProvider();
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

        // Auto-compress if recommended
        if (contextResult.contextInfo.compressRecommended && conv.auto_compress) {
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

        try {
          const emitter = provider.chatStream(chatMessages, { model });

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
            res.write("data: [DONE]\n\n");
            res.end();
          };

          const onError = (err) => {
            if (session_id && fullResponse) {
              config.saveMessage({ conversation_id: session_id, role: "assistant", content: fullResponse });
            }
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
      const result = await provider.chat(chatMessages, { model });

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
