import { getConversationUsage } from "../../services/conversations.js";

const handleStatsGet = async (_req, res, { sendJson }, url) => {
  const conversationId = url.searchParams.get("conversationId");
  if (!conversationId) {
    sendJson(res, 400, { ok: false, error: "conversationId is required" });
    return;
  }
  const usage = getConversationUsage(conversationId);
  sendJson(res, 200, { ok: true, usage });
};

export { handleStatsGet };
