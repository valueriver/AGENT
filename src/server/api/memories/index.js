import { handleMemoryDelete } from "./delete.js";
import { handleMemoryGet } from "./get.js";
import { handleMemoriesListGet } from "./list.js";
import { handleMemoryPatch } from "./patch.js";
import { handleMemoryPost } from "./post.js";

const handleMemoriesApi = async (req, res, deps, path, method, url) => {
  const { sendJson } = deps;

  if (path === "/api/memories" && method === "GET") {
    await handleMemoriesListGet(req, res, deps, url);
    return;
  }
  if (path === "/api/memories" && method === "POST") {
    await handleMemoryPost(req, res, deps);
    return;
  }
  const detailMatch = path.match(/^\/api\/memories\/(\d+)$/);
  if (detailMatch) {
    const id = detailMatch[1];
    if (method === "GET") {
      await handleMemoryGet(req, res, deps, id);
      return;
    }
    if (method === "PATCH") {
      await handleMemoryPatch(req, res, deps, id);
      return;
    }
    if (method === "DELETE") {
      await handleMemoryDelete(req, res, deps, id);
      return;
    }
  }

  sendJson(res, 404, { ok: false, error: "Not found" });
};

export { handleMemoriesApi };
