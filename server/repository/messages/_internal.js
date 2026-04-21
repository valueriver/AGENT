const INSERT_SQL = `
  INSERT INTO messages (conversation_id, message, anchor, usage, meta)
  VALUES (?, ?, ?, ?, ?)
`;

const insertOne = (db, conversationId, message) => {
  const anchor = message?.anchor ? String(message.anchor) : null;
  const usage = message?.usage ? JSON.stringify(message.usage) : null;
  const meta = message?.meta ? JSON.stringify(message.meta) : null;
  db.prepare(INSERT_SQL).run(
    Number(conversationId),
    JSON.stringify(message),
    anchor,
    usage,
    meta
  );
};

const lastSummaryOf = (messages) => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.summary) return String(messages[i].summary);
  }
  return null;
};

const touchConversationStmt = (db, conversationId, summary) => {
  if (summary !== null) {
    db.prepare("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP, summary = ? WHERE id = ?")
      .run(summary, Number(conversationId));
  } else {
    db.prepare("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(Number(conversationId));
  }
};

export { insertOne, lastSummaryOf, touchConversationStmt };
