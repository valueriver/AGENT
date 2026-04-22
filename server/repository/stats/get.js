import { getDb } from "../db.js";

const getConversationUsage = (conversationId) => {
  const row = getDb().prepare(`
    SELECT
      COALESCE(SUM(CAST(json_extract(usage, '$.promptTokens') AS INTEGER)), 0) AS promptTokens,
      COALESCE(SUM(CAST(json_extract(usage, '$.cachedPromptTokens') AS INTEGER)), 0) AS cachedPromptTokens,
      COALESCE(SUM(CAST(json_extract(usage, '$.completionTokens') AS INTEGER)), 0) AS completionTokens,
      COALESCE(SUM(CAST(json_extract(usage, '$.totalTokens') AS INTEGER)), 0) AS totalTokens,
      COUNT(usage) AS recordedResponses
    FROM messages
    WHERE conversation_id = ? AND usage IS NOT NULL
  `).get(Number(conversationId));
  return {
    promptTokens: Number(row.promptTokens) || 0,
    cachedPromptTokens: Number(row.cachedPromptTokens) || 0,
    completionTokens: Number(row.completionTokens) || 0,
    totalTokens: Number(row.totalTokens) || 0,
    recordedResponses: Number(row.recordedResponses) || 0,
  };
};

export { getConversationUsage };
