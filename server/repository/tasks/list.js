import { getDb } from "../db.js";

const listTasks = ({ conversationId, limit = 50 } = {}) => {
  const db = getDb();
  if (conversationId) {
    return db
      .prepare(
        `SELECT * FROM tasks
         WHERE parent_conversation_id = ? OR child_conversation_id = ?
         ORDER BY id DESC LIMIT ?`
      )
      .all(conversationId, conversationId, limit);
  }
  return db.prepare("SELECT * FROM tasks ORDER BY id DESC LIMIT ?").all(limit);
};

export { listTasks };
