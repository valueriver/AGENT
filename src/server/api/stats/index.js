import { handleStatsGet } from "./get.js";

const handleStatsApi = async (req, res, deps, path, method, url) => {
  const { sendJson } = deps;
  if (path === "/api/stats" && method === "GET") {
    await handleStatsGet(req, res, deps, url);
    return;
  }
  sendJson(res, 404, { ok: false, error: "Not found" });
};

export { handleStatsApi };
