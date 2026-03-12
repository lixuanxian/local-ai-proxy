const { Router } = require("express");

module.exports = function createAnthropicRouter(providerRegistry) {
  const router = Router();

  // Messages endpoint (Anthropic-compatible)
  router.post("/v1/messages", async (req, res) => {
    try {
      const { model, messages, system, stream, provider: providerName } = req.body;

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
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

      for (const msg of messages) {
        let content;
        if (typeof msg.content === "string") {
          content = msg.content;
        } else if (Array.isArray(msg.content)) {
          content = msg.content
            .map((block) => {
              if (block.type === "text") return block.text;
              if (block.type === "image") return "[image]";
              return JSON.stringify(block);
            })
            .join("\n");
        } else {
          content = String(msg.content);
        }
        unifiedMessages.push({ role: msg.role, content });
      }

      const resolvedName = providerRegistry.resolve(providerName, model);
      const provider = providerRegistry.get(resolvedName);

      if (!provider) {
        return res.status(400).json({
          type: "error",
          error: {
            type: "invalid_request_error",
            message: `Unknown provider: "${resolvedName}". Available: ${providerRegistry.listNames().join(", ")}`,
          },
        });
      }

      console.log(`[${new Date().toISOString()}] (messages API) ${resolvedName} | ${model || "default"} | messages: ${unifiedMessages.length}`);

      // Streaming (Anthropic SSE format)
      if (stream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        const msgId = `msg_${Date.now()}`;

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
          const emitter = provider.chatStream(unifiedMessages, { model });

          const onText = (text) => {
            const delta = {
              type: "content_block_delta",
              index: 0,
              delta: { type: "text_delta", text },
            };
            res.write(`event: content_block_delta\ndata: ${JSON.stringify(delta)}\n\n`);
          };

          const onDone = () => {
            res.write(`event: content_block_stop\ndata: ${JSON.stringify({ type: "content_block_stop", index: 0 })}\n\n`);
            res.write(`event: message_delta\ndata: ${JSON.stringify({ type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 0 } })}\n\n`);
            res.write(`event: message_stop\ndata: ${JSON.stringify({ type: "message_stop" })}\n\n`);
            res.end();
          };

          const onError = (err) => {
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
      const result = await provider.chat(unifiedMessages, { model });
      const content = result.choices?.[0]?.message?.content || "";

      res.json({
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
      });
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
