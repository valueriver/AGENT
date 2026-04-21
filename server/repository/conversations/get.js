import { getDb } from "../db.js";

const getConversation = (conversationId) =>
  getDb().prepare("SELECT id, title, summary, created_at, updated_at FROM conversations WHERE id = ?")
    .get(Number(conversationId)) || null;

export { getConversation };
