import { getDb } from "../db.js";

const createConversation = (title) => {
  const trimmed = String(title || "").trim();
  if (!trimmed) throw new Error("title is required");
  const result = getDb().prepare("INSERT INTO conversations (title) VALUES (?)").run(trimmed);
  return { id: String(result.lastInsertRowid), title: trimmed };
};

export { createConversation };
