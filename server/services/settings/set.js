import { setConfigRecord } from "../../repository/settings/index.js";

const setServerConfig = (cfg) => {
  setConfigRecord({
    apiUrl: cfg.apiUrl || "",
    apiKey: cfg.apiKey || "",
    model: cfg.model || "",
    system: cfg.system || "",
    contextTurns: Math.max(0, Number.parseInt(cfg.contextTurns, 10) || 0),
  });
};

export { setServerConfig };
