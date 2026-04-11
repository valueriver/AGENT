import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "../../data/agent.db");

let db;

export const initDb = () => {
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      base_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT,
      type TEXT,
      tool_calls TEXT,
      arguments TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (base_id) REFERENCES bases(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_base ON messages(base_id);
  `);
};

export const getDb = () => db;

// 配置操作
export const configOps = {
  get: () => {
    const rows = db.prepare("SELECT key, value FROM config").all();
    const cfg = {};
    rows.forEach(r => { cfg[r.key] = JSON.parse(r.value); });
    return cfg;
  },
  set: (cfg) => {
    const stmt = db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)");
    const tx = db.transaction((data) => {
      for (const [key, value] of Object.entries(data)) {
        stmt.run(key, JSON.stringify(value));
      }
    });
    tx(cfg);
  },
};

// Base 操作
export const baseOps = {
  list: (page = 1, limit = 20, search = "") => {
    const offset = (page - 1) * limit;
    const total = db.prepare(
      search
        ? "SELECT COUNT(*) as count FROM bases b JOIN messages m ON m.base_id = b.id WHERE m.content LIKE ? GROUP BY b.id"
        : "SELECT COUNT(*) as count FROM bases"
    ).get(search ? `%${search}%` : []);

    const bases = db.prepare(`
      SELECT b.id, b.created_at, b.updated_at, COUNT(m.id) as messageCount
      FROM bases b
      LEFT JOIN messages m ON m.base_id = b.id
      ${search ? "WHERE m.content LIKE ?" : ""}
      GROUP BY b.id
      ORDER BY b.updated_at DESC
      LIMIT ? OFFSET ?
    `).all(search ? [`%${search}%`, limit, offset] : [limit, offset]);

    return {
      bases: bases.map(b => ({
        id: String(b.id),
        createdAt: b.created_at,
        lastModified: b.updated_at,
        messageCount: b.messageCount,
        preview: b.messageCount > 0 ? db.prepare(
          "SELECT content FROM messages WHERE base_id = ? ORDER BY id DESC LIMIT 1"
        ).get(b.id)?.content?.slice(0, 50) || "" : "",
      })),
      total: total.count,
      page,
      limit,
      totalPages: Math.ceil(total.count / limit),
    };
  },
  create: () => {
    const result = db.prepare("INSERT INTO bases DEFAULT VALUES").run();
    return { id: String(result.lastInsertRowid) };
  },
  delete: (id) => {
    db.prepare("DELETE FROM bases WHERE id = ?").run(Number(id));
  },
  update: (baseId) => {
    db.prepare("UPDATE bases SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(Number(baseId));
  },
};

// Message 操作
export const messageOps = {
  get: (baseId, page = 1, limit = 50) => {
    const offset = (page - 1) * limit;
    const total = db.prepare(
      "SELECT COUNT(*) as count FROM messages WHERE base_id = ?"
    ).get(Number(baseId)).count;

    const messages = db.prepare(`
      SELECT role, content, type, tool_calls, arguments
      FROM messages
      WHERE base_id = ?
      ORDER BY id ASC
      LIMIT ? OFFSET ?
    `).all(Number(baseId), limit, offset);

    return {
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
        ...(m.type && { type: m.type }),
        ...(m.tool_calls && { tool_calls: JSON.parse(m.tool_calls) }),
        ...(m.arguments && { arguments: JSON.parse(m.arguments) }),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  search: (query, page = 1, limit = 20) => {
    const offset = (page - 1) * limit;
    const total = db.prepare(
      "SELECT COUNT(*) as count FROM messages WHERE content LIKE ?"
    ).get(`%${query}%`).count;

    const results = db.prepare(`
      SELECT m.id, m.base_id, m.role, m.content, m.created_at, b.updated_at as base_updated
      FROM messages m
      JOIN bases b ON m.base_id = b.id
      WHERE m.content LIKE ?
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `).all(`%${query}%`, limit, offset);

    return {
      results: results.map(r => ({
        id: r.id,
        baseId: String(r.base_id),
        role: r.role,
        content: r.content,
        createdAt: r.created_at,
        baseUpdatedAt: r.base_updated,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },
  saveBatch: (baseId, messages) => {
    const insert = db.prepare(
      "INSERT INTO messages (base_id, role, content, type, tool_calls, arguments) VALUES (?, ?, ?, ?, ?, ?)"
    );
    const tx = db.transaction((msgs) => {
      for (const msg of msgs) {
        insert.run(
          Number(baseId),
          msg.role,
          msg.content ?? null,
          msg.type ?? null,
          msg.tool_calls ? JSON.stringify(msg.tool_calls) : null,
          msg.arguments ? JSON.stringify(msg.arguments) : null
        );
      }
      db.prepare("UPDATE bases SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(Number(baseId));
    });
    tx(messages);
  },
  clear: (baseId) => {
    db.prepare("DELETE FROM messages WHERE base_id = ?").run(Number(baseId));
    db.prepare("UPDATE bases SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(Number(baseId));
  },
  append: (baseId, msg) => {
    db.prepare(
      "INSERT INTO messages (base_id, role, content, type, tool_calls, arguments) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(
      Number(baseId),
      msg.role,
      msg.content ?? null,
      msg.type ?? null,
      msg.tool_calls ? JSON.stringify(msg.tool_calls) : null,
      msg.arguments ? JSON.stringify(msg.arguments) : null
    );
    db.prepare("UPDATE bases SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(Number(baseId));
  },
};
