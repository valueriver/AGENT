import { handleAnchorsGet } from "./get.js";

const handleAnchorsApi = async (req, res, deps, path, method, url) => {
  const { sendJson } = deps;
  if (path === "/api/anchors" && method === "GET") {
    await handleAnchorsGet(req, res, deps, url);
    return;
  }
  sendJson(res, 404, { ok: false, error: "Not found" });
};

export { handleAnchorsApi };
