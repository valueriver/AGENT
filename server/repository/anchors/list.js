import { getDb } from "../db.js";

const listAnchors = (conversationId) =>
  getDb().prepare(`
    SELECT id, anchor, created_at FROM messages
    WHERE conversation_id = ? AND anchor IS NOT NULL
    ORDER BY id ASC
  `).all(Number(conversationId));

const listAnchorsBefore = (conversationId, boundaryId, limit = 30) =>
  getDb().prepare(`
    SELECT id, anchor, created_at FROM messages
    WHERE conversation_id = ? AND anchor IS NOT NULL AND id < ?
    ORDER BY id DESC LIMIT ?
  `).all(Number(conversationId), Number(boundaryId), Number(limit));

export { listAnchors, listAnchorsBefore };
