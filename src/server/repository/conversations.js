import { getDb, initDb } from "./db.js";

initDb();

const listConversations = (page = 1, limit = 20, search = "") => {
  const db = getDb();
  const offset = (page - 1) * limit;

  const totalQuery = search
    ? `
      SELECT COUNT(DISTINCT c.id) AS count
      FROM conversations c
      JOIN messages m ON m.conversation_id = c.id
      WHERE m.message LIKE ?
    `
    : "SELECT COUNT(*) AS count FROM conversations";
  const totalRow = db.prepare(totalQuery).get(search ? `%${search}%` : []);
  const total = Number(totalRow?.count) || 0;

  const rows = db.prepare(`
    SELECT c.id, c.created_at, c.updated_at, COUNT(m.id) AS messageCount
    FROM conversations c
    LEFT JOIN messages m ON m.conversation_id = c.id
    ${search ? "WHERE m.message LIKE ?" : ""}
    GROUP BY c.id
    ORDER BY c.updated_at DESC
    LIMIT ? OFFSET ?
  `).all(search ? [`%${search}%`, limit, offset] : [limit, offset]);

  return {
    conversations: rows.map((row) => ({
      id: String(row.id),
      createdAt: row.created_at,
      lastModified: row.updated_at,
      messageCount: row.messageCount,
      preview: row.messageCount > 0
        ? (() => {
          const latest = db.prepare(
            "SELECT message FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 1"
          ).get(row.id);
          const content = JSON.parse(latest?.message || "{}")?.content;
          return typeof content === "string" ? content.slice(0, 50) : "";
        })()
        : "",
    })),
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
