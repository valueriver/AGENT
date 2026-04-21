import { handleConversationsCreatePost } from "./create.js";
import { handleConversationsDelete } from "./delete.js";
import { handleConversationsListGet } from "./list.js";
import { handleConversationsMessagesGet } from "./messages.js";
import { handleConversationsStatsGet } from "./stats.js";

const handleConversationsApi = async (req, res, deps, path, method, url) => {
  const { sendJson } = deps;

  if (path === "/api/conversations" && method === "GET") {
    await handleConversationsListGet(req, res, deps);
    return;
  }

  if (path === "/api/conversations" && method === "POST") {
    await handleConversationsCreatePost(req, res, deps);
    return;
  }

  if (method === "DELETE" && path.startsWith("/api/conversations/")) {
    await handleConversationsDelete(req, res, deps);
    return;
  }

  if (method === "GET" && path.match(/^\/api\/conversations\/[^/]+\/messages$/)) {
    await handleConversationsMessagesGet(req, res, deps);
    return;
  }

  if (method === "GET" && path.match(/^\/api\/conversations\/[^/]+\/stats$/)) {
    await handleConversationsStatsGet(req, res, deps);
    return;
  }

  sendJson(res, 404, { ok: false, error: "Not found" });
};

export { handleConversationsApi };
