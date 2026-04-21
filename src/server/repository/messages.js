import { getDb, initDb } from "./db.js";

initDb();

const toRow = (message) => {
  const role = String(message?.role || "").trim();
  if (!role) throw new Error("message.role is required");
  const content = message?.content === null || message?.content === undefined
    ? null
    : String(message.content);
  return {
    role,
    content,
    tool_calls: Array.isArray(message?.tool_calls) && message.tool_calls.length
      ? JSON.stringify(message.tool_calls)
      : null,
    tool_call_id: message?.tool_call_id ? String(message.tool_call_id) : null,
    reasoning_content: message?.reasoning_content ? String(message.reasoning_content) : null,
    recap: message?.recap ? String(message.recap) : null,
    usage: message?.usage ? JSON.stringify(message.usage) : null,
    meta: message?.meta ? JSON.stringify(message.meta) : null,
  };
};

const fromRow = (row) => {
  const message = { role: row.role };
  if (row.content !== null) message.content = row.content;
  if (row.tool_calls) message.tool_calls = JSON.parse(row.tool_calls);
  if (row.tool_call_id) message.tool_call_id = row.tool_call_id;
  if (row.reasoning_content) message.reasoning_content = row.reasoning_content;
  if (row.usage) message.usage = JSON.parse(row.usage);
  message._id = row.id;
  if (row.recap) message._recap = row.recap;
  if (row.meta) message._meta = JSON.parse(row.meta);
  return message;
};

const INSERT_SQL = `
  INSERT INTO messages
    (conversation_id, role, content, tool_calls, tool_call_id, reasoning_content, recap, usage, meta)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const SELECT_COLUMNS = "id, role, content, tool_calls, tool_call_id, reasoning_content, recap, usage, meta";

const listMessages = (conversationId, page = 1, limit = 50, order = "asc") => {
  const db = getDb();
  const offset = (page - 1) * limit;
  const normalizedOrder = String(order).toLowerCase() === "desc" ? "DESC" : "ASC";
  const total = Number(
    db.prepare("SELECT COUNT(*) AS count FROM messages WHERE conversation_id = ?")
      .get(Number(conversationId))?.count
  ) || 0;

  const rows = db.prepare(`
    SELECT ${SELECT_COLUMNS}
    FROM messages
    WHERE conversation_id = ?
    ORDER BY id ${normalizedOrder}
    LIMIT ? OFFSET ?
  `).all(Number(conversationId), limit, offset);

  return {
    messages: rows.map(fromRow),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
};

const listRecaps = (conversationId) => {
  const rows = getDb().prepare(`
    SELECT id, recap, created_at FROM messages
    WHERE conversation_id = ? AND recap IS NOT NULL
    ORDER BY id ASC
  `).all(Number(conversationId));
  return rows;
};

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
  const insert = db.prepare(INSERT_SQL);
  const tx = db.transaction((items) => {
    for (const message of items) {
      const row = toRow(message);
      insert.run(
        Number(conversationId),
        row.role,
        row.content,
        row.tool_calls,
        row.tool_call_id,
        row.reasoning_content,
        row.recap,
        row.usage,
        row.meta
      );
    }
    db.prepare("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(Number(conversationId));
  });
  tx(messages);
};

const appendMessage = (conversationId, message) => {
  const db = getDb();
  const row = toRow(message);
  db.prepare(INSERT_SQL).run(
    Number(conversationId),
    row.role,
    row.content,
    row.tool_calls,
    row.tool_call_id,
    row.reasoning_content,
    row.recap,
    row.usage,
    row.meta
  );
  db.prepare("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .run(Number(conversationId));
};

export {
  appendMessage,
  getConversationUsage,
  listMessages,
  listRecaps,
  saveMessageBatch,
};
