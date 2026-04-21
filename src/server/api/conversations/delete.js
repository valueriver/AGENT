import { deleteConversation } from "../../services/conversations.js";

const handleConversationsDelete = async (req, res, { sendJson }) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  const conversationId = url.pathname.split("/").pop();
  deleteConversation(conversationId);
  sendJson(res, 200, { ok: true, message: `Conversation ${conversationId} deleted` });
};

export { handleConversationsDelete };
