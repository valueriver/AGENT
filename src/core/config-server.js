import { configOps, initDb } from "./db.js";

// 确保数据库已初始化
initDb();

export const serverConfig = {
  get: () => {
    try {
      return configOps.get();
    } catch {
      return { apiUrl: "", apiKey: "", model: "" };
    }
  },
  set: (cfg) => {
    configOps.set({
      apiUrl: cfg.apiUrl || "",
      apiKey: cfg.apiKey || "",
      model: cfg.model || "",
    });
  },
};
