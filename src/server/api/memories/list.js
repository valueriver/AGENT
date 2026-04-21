import { listMemories } from "../../repository/memories.js";

const handleMemoriesListGet = async (_req, res, { sendJson }, url) => {
  const enabled = url.searchParams.get("enabled");
  const pinned = url.searchParams.get("pinned");
  const creator = url.searchParams.get("creator");
  const items = listMemories({ enabled, pinned, creator });
  sendJson(res, 200, { ok: true, memories: items });
};

export { handleMemoriesListGet };
