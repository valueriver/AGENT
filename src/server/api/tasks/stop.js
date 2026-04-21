import { abortTask } from "../../services/tasks.js";

const handleTaskStop = async (_req, res, { sendJson }, id) => {
  try {
    const task = abortTask(id);
    sendJson(res, 200, { ok: true, task });
  } catch (error) {
    sendJson(res, 404, { ok: false, error: error.message });
  }
};

export { handleTaskStop };
