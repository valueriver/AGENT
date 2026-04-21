import { getDb } from "../db.js";

const getConfigRecord = () => {
  const rows = getDb().prepare("SELECT key, value FROM config").all();
  const cfg = {};
  rows.forEach((row) => {
    cfg[row.key] = JSON.parse(row.value);
  });
  return cfg;
};

export { getConfigRecord };
