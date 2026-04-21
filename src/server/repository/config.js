import { getDb, initDb } from "./db.js";

initDb();

const getConfigRecord = () => {
  const db = getDb();
  const rows = db.prepare("SELECT key, value FROM config").all();
  const cfg = {};
  rows.forEach((row) => {
    cfg[row.key] = JSON.parse(row.value);
  });
  return cfg;
};

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

export { getConfigRecord, setConfigRecord };
