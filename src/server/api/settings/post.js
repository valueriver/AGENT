import { setServerConfig } from "../../services/config.js";
import { parseJson } from "../../utils.js";

const handleSettingsPost = async (req, res, { readBody, sendJson }) => {
  const raw = await readBody(req);
  const body = parseJson(raw || "{}", "server.settings.body");
  setServerConfig(body);
  sendJson(res, 200, { ok: true });
};

export { handleSettingsPost };
