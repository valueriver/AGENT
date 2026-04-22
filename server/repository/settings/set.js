import { getDb } from "../db.js";

const setConfigRecord = (cfg) => {
  const db = getDb();
  const stmt = db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)");
  const tx = db.transaction((data) => {
    for (const [key, value] of Object.entries(data)) {
      stmt.run(key, JSON.stringify(value));
    }
  });
  tx(cfg);
};

export { setConfigRecord };
