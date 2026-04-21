import { handleChatApi } from "./chat/index.js";
import { handleConversationsApi } from "./conversations/index.js";
import { handleHealthApi } from "./health/index.js";
import { handleSettingsApi } from "./settings/index.js";
import { handleTaskApi } from "./task/index.js";

const handleApiRequest = async (req, res, deps, context = {}) => {
  const { sendJson } = deps;
  const url = new URL(req.url || "/", "http://127.0.0.1");
  const path = url.pathname;
  const method = req.method;

  try {
    if (path === "/health") {
      return handleHealthApi(req, res, deps, path, method, url, context);
    }
    if (path.startsWith("/api/chat")) {
      return handleChatApi(req, res, deps, path, method, url, context);
    }
    if (path.startsWith("/api/task")) {
      return handleTaskApi(req, res, deps, path, method, url, context);
    }
    if (path.startsWith("/api/conversations")) {
      return handleConversationsApi(req, res, deps, path, method, url, context);
    }
    if (path.startsWith("/api/config")) {
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
