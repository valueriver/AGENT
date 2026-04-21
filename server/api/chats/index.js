import { handleChatPost } from "./post.js";

const handleChatsApi = async (req, res, deps, path, method) => {
  const { sendJson } = deps;

  if (path === "/api/chats" && method === "POST") {
    await handleChatPost(req, res, deps);
    return;
  }

  sendJson(res, 404, { ok: false, error: "Not found" });
};

export { handleChatsApi };
