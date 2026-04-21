import { listTasks } from "../../repository/tasks.js";

const handleTasksListGet = async (_req, res, { sendJson }, url) => {
  const conversationId = url.searchParams.get("conversationId");
  const rawLimit = Number.parseInt(url.searchParams.get("limit"), 10);
  const limit = Math.max(1, Math.min(500, Number.isFinite(rawLimit) ? rawLimit : 50));
  const tasks = listTasks({ conversationId, limit });
  sendJson(res, 200, { ok: true, tasks });
};

export { handleTasksListGet };
