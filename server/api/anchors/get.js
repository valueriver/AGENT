import { listAnchors } from "../../services/anchors/index.js";

const handleAnchorsGet = async (_req, res, { sendJson }, url) => {
  const conversationId = url.searchParams.get("conversationId");
  if (!conversationId) {
    sendJson(res, 400, { ok: false, error: "conversationId is required" });
    return;
  }
  const anchors = listAnchors(conversationId);
  sendJson(res, 200, { ok: true, anchors });
};

export { handleAnchorsGet };
