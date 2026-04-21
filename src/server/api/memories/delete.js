import { deleteMemory, getMemory } from "../../repository/memories.js";

const handleMemoryDelete = async (_req, res, { sendJson }, id) => {
  if (!getMemory(id)) {
    sendJson(res, 404, { ok: false, error: "memory not found" });
    return;
  }
  deleteMemory(id);
  sendJson(res, 200, { ok: true });
};

export { handleMemoryDelete };
