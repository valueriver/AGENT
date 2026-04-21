import { handleTaskPost } from "./post.js";

const handleTaskApi = async (req, res, deps, path, method, url) => {
  const { sendJson } = deps;

  if (path === "/api/task" && method === "POST") {
    await handleTaskPost(req, res, deps);
    return;
  }

  sendJson(res, 404, { ok: false, error: "Not found" });
};

export { handleTaskApi };
