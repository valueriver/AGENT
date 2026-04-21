import { createConversation } from "../../services/conversations.js";

const handleConversationsPost = async (_req, res, { sendJson }) => {
  const conversation = createConversation();
  sendJson(res, 201, { ok: true, conversation });
};

export { handleConversationsPost };
