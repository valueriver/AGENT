import { parseJson } from "../../utils.js";
import { getMemory, updateMemory } from "../../repository/memories.js";

const handleMemoryPatch = async (req, res, { readBody, sendJson }, id) => {
  if (!getMemory(id)) {
    sendJson(res, 404, { ok: false, error: "memory not found" });
    return;
  }
  const raw = await readBody(req);
  const body = parseJson(raw || "{}", "server.memory.body");
  updateMemory(id, body);
  sendJson(res, 200, { ok: true, memory: getMemory(id) });
};

export { handleMemoryPatch };
