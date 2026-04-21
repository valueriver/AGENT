import { getDb } from "../db.js";

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

export { updateMemory };
