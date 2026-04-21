import { getDb } from "../db.js";
import { insertOne, touchConversationStmt } from "./_internal.js";

const appendMessage = (conversationId, message) => {
  const db = getDb();
  insertOne(db, conversationId, message);
  touchConversationStmt(db, conversationId, message?.summary ? String(message.summary) : null);
};

export { appendMessage };
