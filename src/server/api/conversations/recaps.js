import { listRecaps } from "../../services/conversations.js";

const handleConversationsRecapsGet = async (req, res, { sendJson }) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  const parts = url.pathname.split("/");
  const conversationId = parts[parts.length - 2];
  const recaps = listRecaps(conversationId);
  sendJson(res, 200, { ok: true, recaps });
};

export { handleConversationsRecapsGet };
