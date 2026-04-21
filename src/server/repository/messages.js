import { getDb, initDb } from "./db.js";

initDb();

const listMessages = (conversationId, page = 1, limit = 50, order = "asc") => {
  const db = getDb();
  const offset = (page - 1) * limit;
  const normalizedOrder = String(order).toLowerCase() === "desc" ? "DESC" : "ASC";
  const total = Number(
    db.prepare("SELECT COUNT(*) AS count FROM messages WHERE conversation_id = ?")
      .get(Number(conversationId))?.count
  ) || 0;

  const messages = db.prepare(`
    SELECT id, message, meta
    FROM messages
    WHERE conversation_id = ?
    ORDER BY id ${normalizedOrder}
    LIMIT ? OFFSET ?
  `).all(Number(conversationId), limit, offset);

  return {
    messages: messages.map((row) => ({
      ...JSON.parse(row.message),
      _id: row.id,
      _meta: row.meta ? JSON.parse(row.meta) : null,
    })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
};

const getConversationUsage = (conversationId) => {
  const db = getDb();
  const rows = db.prepare(
    "SELECT message FROM messages WHERE conversation_id = ?"
  ).all(Number(conversationId));

  return rows.reduce((summary, row) => {
    const usage = JSON.parse(row.message)?.usage;
    if (!usage) {
      return summary;
    }
    summary.promptTokens += Number(usage.promptTokens) || 0;
    summary.cachedPromptTokens += Number(usage.cachedPromptTokens) || 0;
    summary.completionTokens += Number(usage.completionTokens) || 0;
    summary.totalTokens += Number(usage.totalTokens) || 0;
    summary.recordedResponses += 1;
    return summary;
  }, {
    promptTokens: 0,
    cachedPromptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    recordedResponses: 0,
  });
};

const saveMessageBatch = (conversationId, messages) => {
  const db = getDb();
  const insert = db.prepare(`
    INSERT INTO messages (conversation_id, message, meta)
    VALUES (?, ?, ?)
  `);
  const tx = db.transaction((items) => {
    for (const message of items) {
      insert.run(
        Number(conversationId),
        JSON.stringify(message),
        null
      );
    }
    db.prepare(
      "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(Number(conversationId));
  });
  tx(messages);
};

const appendMessage = (conversationId, message) => {
  const db = getDb();
  db.prepare(`
    INSERT INTO messages (conversation_id, message, meta)
    VALUES (?, ?, ?)
  `).run(
    Number(conversationId),
    JSON.stringify(message),
    null
  );
  db.prepare(
    "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(Number(conversationId));
};

export {
  appendMessage,
  getConversationUsage,
  listMessages,
  saveMessageBatch,
};
