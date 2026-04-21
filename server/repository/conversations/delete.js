import { getDb } from "../db.js";

const deleteConversation = (conversationId) => {
  getDb().prepare("DELETE FROM conversations WHERE id = ?").run(Number(conversationId));
};

export { deleteConversation };
