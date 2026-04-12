import { configOps, initDb } from "./db.js";

// 确保数据库已初始化
initDb();

export const serverConfig = {
  get: () => {
    try {
      const cfg = configOps.get();
      return {
        apiUrl: cfg.apiUrl || "",
        apiKey: cfg.apiKey || "",
        model: cfg.model || "",
        contextTurns: Number.isInteger(Number(cfg.contextTurns)) ? Number(cfg.contextTurns) : 10,
      };
    } catch {
      return { apiUrl: "", apiKey: "", model: "", contextTurns: 10 };
    }
  },
  set: (cfg) => {
    configOps.set({
      apiUrl: cfg.apiUrl || "",
      apiKey: cfg.apiKey || "",
      model: cfg.model || "",
      contextTurns: Math.max(0, parseInt(cfg.contextTurns, 10) || 0),
    });
  },
};
