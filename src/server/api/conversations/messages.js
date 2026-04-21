import { listMessages } from "../../services/conversations.js";

const handleConversationsMessagesGet = async (req, res, { sendJson }) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  const parts = url.pathname.split("/");
  const conversationId = parts[parts.length - 2];
  const page = parseInt(url.searchParams.get("page")) || 1;
  const limit = parseInt(url.searchParams.get("limit")) || 50;
  const order = url.searchParams.get("order") || "asc";
  const result = listMessages(conversationId, page, limit, order);
  sendJson(res, 200, { ok: true, ...result });
};

export { handleConversationsMessagesGet };
