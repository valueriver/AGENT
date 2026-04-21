import { createConversation } from "../../services/conversations.js";

const handleConversationsCreatePost = async (_req, res, { sendJson }) => {
  const conversation = createConversation();
  sendJson(res, 201, { ok: true, conversation });
};

export { handleConversationsCreatePost };
