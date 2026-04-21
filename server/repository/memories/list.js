import { getDb } from "../db.js";

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

export { listMemories };
