import { listConversations } from "../../services/conversations/index.js";

const handleConversationsGet = async (_req, res, { sendJson }, url) => {
  const page = Number.parseInt(url.searchParams.get("page"), 10) || 1;
  const limit = Number.parseInt(url.searchParams.get("limit"), 10) || 20;
  const search = url.searchParams.get("search") || "";
  const result = listConversations(page, limit, search);
  sendJson(res, 200, { ok: true, ...result });
};

export { handleConversationsGet };
