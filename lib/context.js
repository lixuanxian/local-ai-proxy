const config = require("./config");

/**
 * Estimate token count from text (simple heuristic: ~4 chars per token)
 */
function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Build a context window for a conversation, respecting the context limit.
 * Returns the messages to send to the provider + context metadata.
 *
 * @param {string} conversationId
 * @param {object} options - { systemPrompt, mode, modePrompts }
 * @returns {{ messages: Array, contextInfo: object }}
 */
function buildContextWindow(conversationId, options = {}) {
  const conv = config.getConversation(conversationId);
  if (!conv) throw new Error("Conversation not found");

  const contextLimit = conv.context_limit || 10;
  const allMessages = config.getNonSummaryMessages(conversationId);
  const summary = config.getLatestSummary(conversationId);

  let contextMessages = [];

  if (summary) {
    // Get messages after the summary point
    const afterSummary = config.getMessagesAfterSummary(conversationId, summary.created_at);
    // Take the most recent (contextLimit - 1) messages, leaving room for summary
    const recentCount = contextLimit - 1;
    if (afterSummary.length > recentCount) {
      contextMessages = afterSummary.slice(-recentCount);
    } else {
      contextMessages = afterSummary;
    }
    // Prepend summary as a system message
    contextMessages.unshift({
      role: "system",
      content: summary.content,
      is_summary: true,
      id: summary.id,
      token_estimate: summary.token_estimate,
    });
  } else {
    // No summary: take the most recent contextLimit messages
    if (allMessages.length > contextLimit) {
      contextMessages = allMessages.slice(-contextLimit);
    } else {
      contextMessages = [...allMessages];
    }
  }

  // Calculate token estimates
  let estimatedTokens = 0;
  for (const m of contextMessages) {
    estimatedTokens += m.token_estimate || estimateTokens(m.content);
  }

  // Determine if compression is recommended:
  // There are messages not covered by any summary and not in the context window
  let uncoveredCount = 0;
  if (summary) {
    // Messages after summary but before context window
    const afterSummary = config.getMessagesAfterSummary(conversationId, summary.created_at);
    const inContext = contextLimit - 1;
    uncoveredCount = Math.max(0, afterSummary.length - inContext);
  } else {
    uncoveredCount = Math.max(0, allMessages.length - contextLimit);
  }
  const compressRecommended = uncoveredCount > 0;

  // Build system prompt
  const modePrompts = options.modePrompts || {
    plan: "You are in Plan mode. Before implementing anything, first analyze the request and create a detailed step-by-step plan. Outline your approach, list the key considerations, potential issues, and proposed solutions. Structure your response with clear headings and numbered steps. Only after presenting the plan should you ask if the user wants to proceed with implementation.",
    edit: "You are in Edit mode. Directly implement changes, write code, and provide concrete solutions. Be concise and action-oriented. Focus on producing working code and clear modifications rather than lengthy explanations.",
  };

  const systemParts = [];
  if (options.systemPrompt) systemParts.push(options.systemPrompt);
  if (options.mode && modePrompts[options.mode]) systemParts.push(modePrompts[options.mode]);

  // Format messages for the provider
  const chatMessages = contextMessages.map(m => ({
    role: m.role,
    content: m.content,
    ...(m.attachments ? { attachments: typeof m.attachments === "string" ? JSON.parse(m.attachments) : m.attachments } : {}),
  }));

  // Prepend system prompt (merge with summary if the first message is already a summary system message)
  if (systemParts.length > 0) {
    const systemContent = systemParts.join("\n\n");
    if (chatMessages.length > 0 && chatMessages[0].role === "system") {
      // Merge system prompt with summary
      chatMessages[0] = { role: "system", content: systemContent + "\n\n" + chatMessages[0].content };
    } else {
      chatMessages.unshift({ role: "system", content: systemContent });
    }
  }

  const contextInfo = {
    totalMessages: allMessages.length,
    contextMessages: contextMessages.length,
    contextLimit,
    hasSummary: !!summary,
    estimatedTokens,
    compressRecommended,
    autoCompress: !!conv.auto_compress,
  };

  return { messages: chatMessages, contextInfo };
}

/**
 * Compress older messages into a summary using the AI provider.
 *
 * @param {string} conversationId
 * @param {object} provider - provider instance with chat() method
 * @param {string} model - model to use for summarization
 * @returns {Promise<{ summary: object, contextInfo: object }>}
 */
async function compressConversation(conversationId, provider, model) {
  const conv = config.getConversation(conversationId);
  if (!conv) throw new Error("Conversation not found");

  const contextLimit = conv.context_limit || 10;
  const allMessages = config.getNonSummaryMessages(conversationId);

  if (allMessages.length <= contextLimit) {
    // Nothing to compress
    const { contextInfo } = buildContextWindow(conversationId, {});
    return { summary: null, contextInfo };
  }

  // Messages to keep in context (most recent contextLimit - 1)
  const keepCount = contextLimit - 1;
  const messagesToSummarize = allMessages.slice(0, allMessages.length - keepCount);
  const lastSummarizedMsg = messagesToSummarize[messagesToSummarize.length - 1];

  // Build summarization prompt
  const conversationText = messagesToSummarize.map(m => {
    const role = m.role === "user" ? "User" : m.role === "assistant" ? "Assistant" : "System";
    return `${role}: ${m.content}`;
  }).join("\n\n");

  const summaryPrompt = [
    {
      role: "system",
      content: "You are a conversation summarizer. Summarize the following conversation concisely, preserving key facts, decisions, context, and any important details needed for future reference. Focus on what was discussed, what was agreed upon, and any actionable items. Output only the summary, no preamble.",
    },
    {
      role: "user",
      content: `Please summarize this conversation:\n\n${conversationText}`,
    },
  ];

  // Call the provider to generate the summary
  const result = await provider.chat(summaryPrompt, { model });
  const summaryText = result?.choices?.[0]?.message?.content
    || result?.content?.[0]?.text
    || (typeof result === "string" ? result : JSON.stringify(result));

  // Delete old summaries
  config.deleteSummaries(conversationId);

  // Save the new summary message
  const summaryContent = `[Conversation Summary - covering ${messagesToSummarize.length} messages]\n\n${summaryText}`;
  const summaryId = config.saveMessage({
    conversation_id: conversationId,
    role: "system",
    content: summaryContent,
    is_summary: true,
    summarizes_up_to: lastSummarizedMsg.id,
    token_estimate: estimateTokens(summaryContent),
  });

  // Rebuild context info
  const { contextInfo } = buildContextWindow(conversationId, {});
  const summaryMsg = { id: summaryId, content: summaryContent, role: "system", is_summary: true };

  return { summary: summaryMsg, contextInfo };
}

module.exports = {
  estimateTokens,
  buildContextWindow,
  compressConversation,
};
