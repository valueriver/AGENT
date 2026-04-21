import { getMemory } from "../../repository/memories.js";

const handleMemoryGet = async (_req, res, { sendJson }, id) => {
  const memory = getMemory(id);
  if (!memory) {
    sendJson(res, 404, { ok: false, error: "memory not found" });
    return;
  }
  sendJson(res, 200, { ok: true, memory });
};

export { handleMemoryGet };
