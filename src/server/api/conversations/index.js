import { handleConversationsDelete } from "./delete.js";
import { handleConversationsGet } from "./get.js";
import { handleConversationsPost } from "./post.js";

const handleConversationsApi = async (req, res, deps, path, method, url) => {
  const { sendJson } = deps;
  if (path !== "/api/conversations") {
    sendJson(res, 404, { ok: false, error: "Not found" });
    return;
  }
  if (method === "GET") {
    await handleConversationsGet(req, res, deps, url);
    return;
  }
  if (method === "POST") {
    await handleConversationsPost(req, res, deps);
    return;
  }
  if (method === "DELETE") {
    await handleConversationsDelete(req, res, deps, url);
    return;
  }
  sendJson(res, 404, { ok: false, error: "Not found" });
};

export { handleConversationsApi };
