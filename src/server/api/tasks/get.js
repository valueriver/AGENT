import { getTask } from "../../repository/tasks.js";

const handleTaskGet = async (_req, res, { sendJson }, id) => {
  const task = getTask(id);
  if (!task) {
    sendJson(res, 404, { ok: false, error: "task not found" });
    return;
  }
  sendJson(res, 200, { ok: true, task });
};

export { handleTaskGet };
