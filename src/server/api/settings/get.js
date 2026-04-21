import { getServerConfig } from "../../services/config.js";

const handleGetSettings = async (_req, res, { sendJson }) => {
  sendJson(res, 200, { ok: true, config: getServerConfig() });
};

export { handleGetSettings };
