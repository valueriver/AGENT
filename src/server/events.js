const baseSubscribers = new Map();

const subscribeBase = (baseDir, res) => {
  const key = String(baseDir);
  const set = baseSubscribers.get(key) || new Set();
  set.add(res);
  baseSubscribers.set(key, set);
};

const unsubscribeBase = (baseDir, res) => {
  const key = String(baseDir);
  const set = baseSubscribers.get(key);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) {
    baseSubscribers.delete(key);
  }
};

const emitBaseEvent = (baseDir, sendSse, event, payload) => {
  const set = baseSubscribers.get(String(baseDir));
  if (!set) return;
  for (const res of set) {
    sendSse(res, event, payload);
  }
};

export { emitBaseEvent, subscribeBase, unsubscribeBase };
