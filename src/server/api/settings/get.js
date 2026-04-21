import { getServerConfig } from "../../services/config.js";

const handleSettingsGet = async (_req, res, { sendJson }) => {
  sendJson(res, 200, { ok: true, settings: getServerConfig() });
};

export { handleSettingsGet };
