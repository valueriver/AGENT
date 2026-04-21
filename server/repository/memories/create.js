import { getDb } from "../db.js";

const createMemory = ({ title, description = "", content, creator = "user", pinned = 0, enabled = 1 }) => {
  const row = getDb()
    .prepare(
      `INSERT INTO memories (title, description, content, creator, pinned, enabled)
       VALUES (?, ?, ?, ?, ?, ?)
       RETURNING id`
    )
    .get(title, description, content, creator, pinned ? 1 : 0, enabled ? 1 : 0);
  return row.id;
};

export { createMemory };
