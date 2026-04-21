import { getConversationUsage } from "../../services/conversations.js";

const handleConversationsStatsGet = async (req, res, { sendJson }) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  const parts = url.pathname.split("/");
  const conversationId = parts[parts.length - 2];
  const usage = getConversationUsage(conversationId);
  sendJson(res, 200, { ok: true, usage });
};

export { handleConversationsStatsGet };
