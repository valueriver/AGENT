import { getDb } from "../db.js";
import { insertOne, lastSummaryOf, touchConversationStmt } from "./_internal.js";

const saveMessageBatch = (conversationId, messages) => {
  const db = getDb();
  const summary = lastSummaryOf(messages);
  const tx = db.transaction((items) => {
    for (const message of items) {
      insertOne(db, conversationId, message);
    }
    touchConversationStmt(db, conversationId, summary);
  });
  tx(messages);
};

export { saveMessageBatch };
