import { getDb } from "../db.js";

const createTaskRow = ({ parentConversationId, childConversationId, name, prompt }) => {
  const row = getDb()
    .prepare(
      `INSERT INTO tasks (parent_conversation_id, child_conversation_id, name, prompt, status)
       VALUES (?, ?, ?, ?, 'pending')
       RETURNING id`
    )
    .get(parentConversationId, childConversationId, name, prompt);
  return row.id;
};

export { createTaskRow };
