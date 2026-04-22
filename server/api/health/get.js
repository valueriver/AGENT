import { getHealth } from "../../services/health/index.js";

const handleHealthGet = async (_req, res, { sendJson }, { port }) => {
  sendJson(res, 200, getHealth(port));
};

export { handleHealthGet };
