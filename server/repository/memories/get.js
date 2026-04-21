import { getDb } from "../db.js";

const PUBLIC_COLUMNS = "id, title, description, content, creator, pinned, enabled, created_at, updated_at";

const getMemory = (id) =>
  getDb().prepare(`SELECT ${PUBLIC_COLUMNS} FROM memories WHERE id = ?`).get(id) || null;

export { getMemory };
