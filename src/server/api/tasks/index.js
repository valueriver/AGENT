import { handleTaskGet } from "./get.js";
import { handleTasksListGet } from "./list.js";
import { handleTaskPost } from "./post.js";
import { handleTaskStop } from "./stop.js";

const handleTasksApi = async (req, res, deps, path, method, url) => {
  const { sendJson } = deps;

  if (path === "/api/tasks" && method === "POST") {
    await handleTaskPost(req, res, deps);
    return;
  }
  if (path === "/api/tasks" && method === "GET") {
    await handleTasksListGet(req, res, deps, url);
    return;
  }
  const detailMatch = path.match(/^\/api\/tasks\/(\d+)$/);
  if (detailMatch && method === "GET") {
    await handleTaskGet(req, res, deps, detailMatch[1]);
    return;
  }
  const stopMatch = path.match(/^\/api\/tasks\/(\d+)\/stop$/);
  if (stopMatch && method === "POST") {
    await handleTaskStop(req, res, deps, stopMatch[1]);
    return;
  }

  sendJson(res, 404, { ok: false, error: "Not found" });
};

export { handleTasksApi };
