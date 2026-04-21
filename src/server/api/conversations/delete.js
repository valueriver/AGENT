import { deleteConversation } from "../../services/conversations.js";

const handleConversationsDelete = async (_req, res, { sendJson }, url) => {
  const id = url.searchParams.get("id");
  if (!id) {
    sendJson(res, 400, { ok: false, error: "id is required" });
    return;
  }
  deleteConversation(id);
  sendJson(res, 200, { ok: true });
};

export { handleConversationsDelete };
