import { setServerConfig } from "../../services/config.js";
import { parseJson } from "../../utils.js";

const handleSetSettings = async (req, res, { readBody, sendJson }) => {
  const raw = await readBody(req);
  const body = parseJson(raw || "{}", "server.config.body");
  setServerConfig(body);
  sendJson(res, 200, { ok: true, message: "Config saved" });
};

export { handleSetSettings };
