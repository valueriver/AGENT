import { listRecaps } from "../../services/conversations.js";

const handleRecapsGet = async (_req, res, { sendJson }, url) => {
  const conversationId = url.searchParams.get("conversationId");
  if (!conversationId) {
    sendJson(res, 400, { ok: false, error: "conversationId is required" });
    return;
  }
  const recaps = listRecaps(conversationId);
  sendJson(res, 200, { ok: true, recaps });
};

export { handleRecapsGet };
