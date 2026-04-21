import { handleTaskPost } from "./post.js";

const handleTasksApi = async (req, res, deps, path, method, url) => {
  const { sendJson } = deps;

  if (path === "/api/tasks" && method === "POST") {
    await handleTaskPost(req, res, deps);
    return;
  }

  sendJson(res, 404, { ok: false, error: "Not found" });
};

export { handleTasksApi };
