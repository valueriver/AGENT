import { getConfigRecord } from "../../repository/config/index.js";

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

export { getServerConfig };
