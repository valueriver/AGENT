import { handleRecapsGet } from "./get.js";

const handleRecapsApi = async (req, res, deps, path, method, url) => {
  const { sendJson } = deps;
  if (path === "/api/recaps" && method === "GET") {
    await handleRecapsGet(req, res, deps, url);
    return;
  }
  sendJson(res, 404, { ok: false, error: "Not found" });
};

export { handleRecapsApi };
