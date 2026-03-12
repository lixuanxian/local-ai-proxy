// Shared utility functions for providers

/**
 * Convert unified message array to a prompt string for CLI providers
 */
function formatMessages(messages) {
  return messages
    .map((m) => {
      if (m.role === "system") return `[System]: ${m.content}`;
      if (m.role === "assistant") return `[Assistant]: ${m.content}`;
      return m.content;
    })
    .join("\n\n");
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

module.exports = { formatMessages, makeResponse };
