import { listConversations } from "../../services/conversations.js";

const handleConversationsListGet = async (req, res, { sendJson }) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  const page = parseInt(url.searchParams.get("page")) || 1;
  const limit = parseInt(url.searchParams.get("limit")) || 20;
  const search = url.searchParams.get("search") || "";
  const result = listConversations(page, limit, search);
  sendJson(res, 200, { ok: true, ...result });
};

export { handleConversationsListGet };
