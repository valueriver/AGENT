import { getDb } from "./db.js";

const PUBLIC_COLUMNS = "id, title, description, content, creator, pinned, enabled, created_at, updated_at";

const listMemories = ({ enabled, pinned, creator } = {}) => {
  const where = [];
  const params = [];
  if (enabled !== undefined && enabled !== null && enabled !== "") {
    where.push("enabled = ?");
    params.push(Number(enabled) ? 1 : 0);
  }
  if (pinned !== undefined && pinned !== null && pinned !== "") {
    where.push("pinned = ?");
    params.push(Number(pinned) ? 1 : 0);
  }
  if (creator) {
    where.push("creator = ?");
    params.push(String(creator));
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const sql = `SELECT ${PUBLIC_COLUMNS} FROM memories ${whereSql} ORDER BY pinned DESC, id DESC`;
  return getDb().prepare(sql).all(...params);
};

const getMemory = (id) =>
  getDb().prepare(`SELECT ${PUBLIC_COLUMNS} FROM memories WHERE id = ?`).get(id) || null;

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

const updateMemory = (id, patch) => {
  const fields = [];
  const values = [];
  if (patch.title !== undefined) {
    fields.push("title = ?");
    values.push(String(patch.title));
  }
  if (patch.description !== undefined) {
    fields.push("description = ?");
    values.push(String(patch.description));
  }
  if (patch.content !== undefined) {
    fields.push("content = ?");
    values.push(String(patch.content));
  }
  if (patch.creator !== undefined) {
    fields.push("creator = ?");
    values.push(String(patch.creator));
  }
  if (patch.pinned !== undefined) {
    fields.push("pinned = ?");
    values.push(patch.pinned ? 1 : 0);
  }
  if (patch.enabled !== undefined) {
    fields.push("enabled = ?");
    values.push(patch.enabled ? 1 : 0);
  }
  if (!fields.length) return false;
  fields.push("updated_at = CURRENT_TIMESTAMP");
  values.push(id);
  const info = getDb().prepare(`UPDATE memories SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return info.changes > 0;
};

const deleteMemory = (id) => {
  const info = getDb().prepare("DELETE FROM memories WHERE id = ?").run(id);
  return info.changes > 0;
};

export { createMemory, deleteMemory, getMemory, listMemories, updateMemory };
