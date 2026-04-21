import { getDb } from "./db.js";

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

const markTaskRunning = (id) => {
  getDb().prepare("UPDATE tasks SET status = 'running' WHERE id = ?").run(id);
};

const markTaskDone = (id, response) => {
  getDb()
    .prepare(
      "UPDATE tasks SET status = 'done', response = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?"
    )
    .run(response, id);
};

const markTaskError = (id, error) => {
  getDb()
    .prepare(
      "UPDATE tasks SET status = 'error', error = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?"
    )
    .run(error, id);
};

const markTaskAborted = (id) => {
  getDb()
    .prepare(
      "UPDATE tasks SET status = 'aborted', finished_at = CURRENT_TIMESTAMP WHERE id = ?"
    )
    .run(id);
};

const getTask = (id) => getDb().prepare("SELECT * FROM tasks WHERE id = ?").get(id) || null;

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

export {
  createTaskRow,
  getTask,
  listTasks,
  markTaskAborted,
  markTaskDone,
  markTaskError,
  markTaskRunning,
};
