import { handleChatsApi } from "./chats/index.js";
import { handleConversationsApi } from "./conversations/index.js";
import { handleHealthApi } from "./health/index.js";
import { handleSettingsApi } from "./settings/index.js";
import { handleTasksApi } from "./tasks/index.js";

const handleApiRequest = async (req, res, deps, context = {}) => {
  const { sendJson } = deps;
  const url = new URL(req.url || "/", "http://127.0.0.1");
  const path = url.pathname;
  const method = req.method;

  try {
    if (path === "/health") {
      return handleHealthApi(req, res, deps, path, method, url, context);
    }
    if (path.startsWith("/api/chats")) {
      return handleChatsApi(req, res, deps, path, method, url, context);
    }
    if (path.startsWith("/api/tasks")) {
      return handleTasksApi(req, res, deps, path, method, url, context);
    }
    if (path.startsWith("/api/conversations")) {
      return handleConversationsApi(req, res, deps, path, method, url, context);
    }
    if (path.startsWith("/api/settings")) {
      return handleSettingsApi(req, res, deps, path, method, url, context);
    }

    sendJson(res, 404, {
      ok: false,
      error: "Not found",
    });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message });
  }
};

const createApiHandler = (deps) => async (req, res, port) =>
  handleApiRequest(req, res, deps, { port });

export { createApiHandler, handleApiRequest };
