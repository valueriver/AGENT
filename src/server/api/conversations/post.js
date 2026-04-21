import { parseJson } from "../../utils.js";
import { createConversation } from "../../services/conversations.js";

const handleConversationsPost = async (req, res, { readBody, sendJson }) => {
  const raw = await readBody(req);
  const body = parseJson(raw || "{}", "server.conversations.body");
  const title = String(body.title || "").trim();
  if (!title) {
    sendJson(res, 400, { ok: false, error: "title is required" });
    return;
  }
  const conversation = createConversation(title);
  sendJson(res, 201, { ok: true, conversation });
};

export { handleConversationsPost };
