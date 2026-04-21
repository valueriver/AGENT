import { handleGetSettings } from "./get.js";
import { handleSetSettings } from "./set.js";

const handleSettingsApi = async (req, res, deps, path, method, url) => {
  const { sendJson } = deps;

  if (path === "/api/config" && method === "GET") {
    await handleGetSettings(req, res, deps);
    return;
  }

  if (path === "/api/config" && method === "POST") {
    await handleSetSettings(req, res, deps);
    return;
  }

  sendJson(res, 404, { ok: false, error: "Not found" });
};

export { handleSettingsApi };
