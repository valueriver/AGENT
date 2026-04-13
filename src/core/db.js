import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "../../data/agent.db");

let db;

const hasTable = (name) => {
  const row = db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?"
  ).get(name);
  return !!row;
};

const hasColumn = (table, column) => {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  return columns.some((entry) => entry.name === column);
};

const migrateLegacyBaseSchema = () => {
  if (!hasTable("bases") || hasTable("conversations")) {
    return;
  }

  db.exec(`
    ALTER TABLE bases RENAME TO conversations;
  `);

  if (hasTable("messages") && hasColumn("messages", "base_id")) {
    db.exec(`
      ALTER TABLE messages RENAME TO messages_legacy;

      CREATE TABLE messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        content TEXT,
        type TEXT,
        tool_calls TEXT,
        arguments TEXT,
        usage TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );

      INSERT INTO messages (id, conversation_id, role, content, type, tool_calls, arguments, usage, created_at)
      SELECT id, base_id, role, content, type, tool_calls, arguments, usage, created_at
      FROM messages_legacy;

      DROP TABLE messages_legacy;
    `);
  }
};

export const initDb = () => {
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  migrateLegacyBaseSchema();

  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT,
      type TEXT,
      tool_calls TEXT,
      arguments TEXT,
      usage TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
  `);

  if (!hasColumn("messages", "usage")) {
    db.exec("ALTER TABLE messages ADD COLUMN usage TEXT");
  }
};

export const getDb = () => db;

export const configOps = {
  get: () => {
    const rows = db.prepare("SELECT key, value FROM config").all();
    const cfg = {};
    rows.forEach((row) => {
      cfg[row.key] = JSON.parse(row.value);
    });
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

export const conversationOps = {
  list: (page = 1, limit = 20, search = "") => {
    const offset = (page - 1) * limit;

    const totalQuery = search
      ? `
        SELECT COUNT(DISTINCT c.id) AS count
        FROM conversations c
        JOIN messages m ON m.conversation_id = c.id
        WHERE m.content LIKE ?
      `
      : "SELECT COUNT(*) AS count FROM conversations";
    const totalRow = db.prepare(totalQuery).get(search ? `%${search}%` : []);
    const total = Number(totalRow?.count) || 0;

    const rows = db.prepare(`
      SELECT c.id, c.created_at, c.updated_at, COUNT(m.id) AS messageCount
      FROM conversations c
      LEFT JOIN messages m ON m.conversation_id = c.id
      ${search ? "WHERE m.content LIKE ?" : ""}
      GROUP BY c.id
      ORDER BY c.updated_at DESC
      LIMIT ? OFFSET ?
    `).all(search ? [`%${search}%`, limit, offset] : [limit, offset]);

    return {
      conversations: rows.map((row) => ({
        id: String(row.id),
        createdAt: row.created_at,
        lastModified: row.updated_at,
        messageCount: row.messageCount,
        preview: row.messageCount > 0
          ? db.prepare(
            "SELECT content FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 1"
          ).get(row.id)?.content?.slice(0, 50) || ""
          : "",
      })),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  },
  create: () => {
    const result = db.prepare("INSERT INTO conversations DEFAULT VALUES").run();
    return { id: String(result.lastInsertRowid) };
  },
  delete: (conversationId) => {
    db.prepare("DELETE FROM conversations WHERE id = ?").run(Number(conversationId));
  },
  update: (conversationId) => {
    db.prepare(
      "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(Number(conversationId));
  },
};

export const messageOps = {
  get: (conversationId, page = 1, limit = 50, order = "asc") => {
    const offset = (page - 1) * limit;
    const normalizedOrder = String(order).toLowerCase() === "desc" ? "DESC" : "ASC";
    const total = Number(
      db.prepare("SELECT COUNT(*) AS count FROM messages WHERE conversation_id = ?")
        .get(Number(conversationId))?.count
    ) || 0;

    const messages = db.prepare(`
      SELECT role, content, type, tool_calls, arguments, usage
      FROM messages
      WHERE conversation_id = ?
      ORDER BY id ${normalizedOrder}
      LIMIT ? OFFSET ?
    `).all(Number(conversationId), limit, offset);

    return {
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
        ...(message.type && { type: message.type }),
        ...(message.tool_calls && { tool_calls: JSON.parse(message.tool_calls) }),
        ...(message.arguments && { arguments: JSON.parse(message.arguments) }),
        ...(message.usage && { usage: JSON.parse(message.usage) }),
      })),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  },

  search: (query, page = 1, limit = 20) => {
    const offset = (page - 1) * limit;
    const total = Number(
      db.prepare("SELECT COUNT(*) AS count FROM messages WHERE content LIKE ?")
        .get(`%${query}%`)?.count
    ) || 0;

    const results = db.prepare(`
      SELECT m.id, m.conversation_id, m.role, m.content, m.created_at, c.updated_at AS conversation_updated
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE m.content LIKE ?
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `).all(`%${query}%`, limit, offset);

    return {
      results: results.map((row) => ({
        id: row.id,
        conversationId: String(row.conversation_id),
        role: row.role,
        content: row.content,
        createdAt: row.created_at,
        conversationUpdatedAt: row.conversation_updated,
      })),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  },

  getUsageSummary: (conversationId) => {
    const rows = db.prepare(
      "SELECT usage FROM messages WHERE conversation_id = ? AND usage IS NOT NULL"
    ).all(Number(conversationId));

    return rows.reduce((summary, row) => {
      const usage = JSON.parse(row.usage);
      summary.promptTokens += Number(usage.promptTokens) || 0;
      summary.cachedPromptTokens += Number(usage.cachedPromptTokens) || 0;
      summary.completionTokens += Number(usage.completionTokens) || 0;
      summary.totalTokens += Number(usage.totalTokens) || 0;
      summary.recordedResponses += 1;
      return summary;
    }, {
      promptTokens: 0,
      cachedPromptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      recordedResponses: 0,
    });
  },

  saveBatch: (conversationId, messages) => {
    const insert = db.prepare(`
      INSERT INTO messages (conversation_id, role, content, type, tool_calls, arguments, usage)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const tx = db.transaction((items) => {
      for (const message of items) {
        insert.run(
          Number(conversationId),
          message.role,
          message.content ?? null,
          message.type ?? null,
          message.tool_calls ? JSON.stringify(message.tool_calls) : null,
          message.arguments ? JSON.stringify(message.arguments) : null,
          message.usage ? JSON.stringify(message.usage) : null
        );
      }
      db.prepare(
        "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).run(Number(conversationId));
    });
    tx(messages);
  },

  append: (conversationId, message) => {
    db.prepare(`
      INSERT INTO messages (conversation_id, role, content, type, tool_calls, arguments, usage)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      Number(conversationId),
      message.role,
      message.content ?? null,
      message.type ?? null,
      message.tool_calls ? JSON.stringify(message.tool_calls) : null,
      message.arguments ? JSON.stringify(message.arguments) : null,
      message.usage ? JSON.stringify(message.usage) : null
    );
    db.prepare(
      "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(Number(conversationId));
  },
};
