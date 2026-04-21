import { handleChatsApi } from "./chats/index.js";
import { handleConversationsApi } from "./conversations/index.js";
import { handleHealthApi } from "./health/index.js";
import { handleMemoriesApi } from "./memories/index.js";
import { handleMessagesApi } from "./messages/index.js";
import { handleRecapsApi } from "./recaps/index.js";
import { handleSettingsApi } from "./settings/index.js";
import { handleStatsApi } from "./stats/index.js";
import { handleTasksApi } from "./tasks/index.js";

const ROUTES = [
  { prefix: "/api/chats", handler: handleChatsApi },
  { prefix: "/api/conversations", handler: handleConversationsApi },
  { prefix: "/api/memories", handler: handleMemoriesApi },
  { prefix: "/api/messages", handler: handleMessagesApi },
  { prefix: "/api/recaps", handler: handleRecapsApi },
  { prefix: "/api/settings", handler: handleSettingsApi },
  { prefix: "/api/stats", handler: handleStatsApi },
  { prefix: "/api/tasks", handler: handleTasksApi },
];

const handleApiRequest = async (req, res, deps, context = {}) => {
  const { sendJson } = deps;
  const url = new URL(req.url || "/", "http://127.0.0.1");
  const path = url.pathname;
  const method = req.method;

  try {
    if (path === "/health") {
      return handleHealthApi(req, res, deps, path, method, url, context);
    }
    for (const route of ROUTES) {
      if (path === route.prefix) {
        return route.handler(req, res, deps, path, method, url, context);
      }
    }
    sendJson(res, 404, { ok: false, error: "Not found" });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message });
  }
};

const createApiHandler = (deps) => async (req, res, port) =>
  handleApiRequest(req, res, deps, { port });

export { createApiHandler, handleApiRequest };
