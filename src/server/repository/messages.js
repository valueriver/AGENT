import { getDb, initDb } from "./db.js";

initDb();

const INSERT_SQL = `
  INSERT INTO messages (conversation_id, message, anchor, usage, meta)
  VALUES (?, ?, ?, ?, ?)
`;

const insertOne = (db, conversationId, message) => {
  const anchor = message?.anchor ? String(message.anchor) : null;
  const usage = message?.usage ? JSON.stringify(message.usage) : null;
  const meta = message?.meta ? JSON.stringify(message.meta) : null;
  db.prepare(INSERT_SQL).run(
    Number(conversationId),
    JSON.stringify(message),
    anchor,
    usage,
    meta
  );
};

const listMessages = (conversationId, page = 1, limit = 50, order = "asc") => {
  const db = getDb();
  const offset = (page - 1) * limit;
  const normalizedOrder = String(order).toLowerCase() === "desc" ? "DESC" : "ASC";
  const total = Number(
    db.prepare("SELECT COUNT(*) AS count FROM messages WHERE conversation_id = ?")
      .get(Number(conversationId))?.count
  ) || 0;

  const rows = db.prepare(`
    SELECT id, message, anchor, usage, meta
    FROM messages
    WHERE conversation_id = ?
    ORDER BY id ${normalizedOrder}
    LIMIT ? OFFSET ?
  `).all(Number(conversationId), limit, offset);

  return {
    messages: rows.map((row) => ({
      ...JSON.parse(row.message),
      _id: row.id,
      ...(row.anchor ? { _anchor: row.anchor } : {}),
      ...(row.meta ? { _meta: JSON.parse(row.meta) } : {}),
    })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
};

const listAnchors = (conversationId) =>
  getDb().prepare(`
    SELECT id, anchor, created_at FROM messages
    WHERE conversation_id = ? AND anchor IS NOT NULL
    ORDER BY id ASC
  `).all(Number(conversationId));

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

const saveMessageBatch = (conversationId, messages) => {
  const db = getDb();
  const tx = db.transaction((items) => {
    for (const message of items) {
      insertOne(db, conversationId, message);
    }
    db.prepare("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(Number(conversationId));
  });
  tx(messages);
};

const appendMessage = (conversationId, message) => {
  const db = getDb();
  insertOne(db, conversationId, message);
  db.prepare("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .run(Number(conversationId));
};

export {
  appendMessage,
  getConversationUsage,
  listAnchors,
  listMessages,
  saveMessageBatch,
};
