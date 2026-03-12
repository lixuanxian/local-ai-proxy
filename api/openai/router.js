const { Router } = require("express");

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
      const { messages, provider: providerName, model, stream } = req.body;

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({
          error: {
            message: "messages is required and must be a non-empty array",
            type: "invalid_request_error",
          },
        });
      }

      const resolvedName = providerRegistry.resolve(providerName, model);
      const provider = providerRegistry.get(resolvedName);

      if (!provider) {
        return res.status(400).json({
          error: {
            message: `Unknown provider: "${resolvedName}". Available: ${providerRegistry.listNames().join(", ")}`,
            type: "invalid_request_error",
          },
        });
      }

      console.log(`[${new Date().toISOString()}] ${resolvedName} | ${model || "default"} | messages: ${messages.length}`);

      // Streaming
      if (stream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        try {
          const emitter = provider.chatStream(messages, { model });

          const onText = (text) => {
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
            res.write("data: [DONE]\n\n");
            res.end();
          };

          const onError = (err) => {
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
      const result = await provider.chat(messages, { model });
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
