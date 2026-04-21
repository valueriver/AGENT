import { getDb, initDb } from "./db.js";

initDb();

const listConversations = (page = 1, limit = 20, search = "") => {
  const db = getDb();
  const offset = (page - 1) * limit;
  const searchLike = search ? `%${search}%` : null;

  const total = Number(
    searchLike
      ? db.prepare(`
          SELECT COUNT(DISTINCT c.id) AS count
          FROM conversations c
          JOIN messages m ON m.conversation_id = c.id
          WHERE m.message LIKE ?
        `).get(searchLike)?.count
      : db.prepare("SELECT COUNT(*) AS count FROM conversations").get()?.count
  ) || 0;

  const rows = searchLike
    ? db.prepare(`
        SELECT c.id, c.summary, c.created_at, c.updated_at, COUNT(m.id) AS messageCount
        FROM conversations c
        LEFT JOIN messages m ON m.conversation_id = c.id
        WHERE m.message LIKE ?
        GROUP BY c.id
        ORDER BY c.updated_at DESC
        LIMIT ? OFFSET ?
      `).all(searchLike, limit, offset)
    : db.prepare(`
        SELECT c.id, c.summary, c.created_at, c.updated_at, COUNT(m.id) AS messageCount
        FROM conversations c
        LEFT JOIN messages m ON m.conversation_id = c.id
        GROUP BY c.id
        ORDER BY c.updated_at DESC
        LIMIT ? OFFSET ?
      `).all(limit, offset);

  const latestStmt = db.prepare(
    "SELECT message FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 1"
  );

  return {
    conversations: rows.map((row) => {
      const latest = row.messageCount > 0 ? latestStmt.get(row.id) : null;
      const content = latest ? JSON.parse(latest.message)?.content : "";
      const preview = typeof content === "string" ? content.slice(0, 50) : "";
      return {
        id: String(row.id),
        summary: row.summary || "",
        createdAt: row.created_at,
        lastModified: row.updated_at,
        messageCount: row.messageCount,
        preview,
      };
    }),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
};

const createConversation = () => {
  const db = getDb();
  const result = db.prepare("INSERT INTO conversations DEFAULT VALUES").run();
  return { id: String(result.lastInsertRowid) };
};

const deleteConversation = (conversationId) => {
  const db = getDb();
  db.prepare("DELETE FROM conversations WHERE id = ?").run(Number(conversationId));
};

const touchConversation = (conversationId) => {
  const db = getDb();
  db.prepare(
    "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(Number(conversationId));
};

export {
  createConversation,
  deleteConversation,
  listConversations,
  touchConversation,
};
