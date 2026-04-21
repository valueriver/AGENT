import { getDb } from "../db.js";

const touchConversation = (conversationId) => {
  getDb().prepare("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .run(Number(conversationId));
};

export { touchConversation };
