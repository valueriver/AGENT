import { getConfigRecord, setConfigRecord } from "../repository/config.js";

const getServerConfig = () => {
  try {
    const cfg = getConfigRecord();
    return {
      apiUrl: cfg.apiUrl || "",
      apiKey: cfg.apiKey || "",
      model: cfg.model || "",
      system: cfg.system || "",
      contextTurns: Number.isInteger(Number(cfg.contextTurns)) ? Number(cfg.contextTurns) : 10,
    };
  } catch {
    return { apiUrl: "", apiKey: "", model: "", system: "", contextTurns: 10 };
  }
};

const setServerConfig = (cfg) => {
  setConfigRecord({
    apiUrl: cfg.apiUrl || "",
    apiKey: cfg.apiKey || "",
    model: cfg.model || "",
    system: cfg.system || "",
    contextTurns: Math.max(0, Number.parseInt(cfg.contextTurns, 10) || 0),
  });
};

export { getServerConfig, setServerConfig };
