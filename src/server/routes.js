import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseJson } from "../core/utils.js";
import { serverConfig } from "../core/config-server.js";
import { initDb, conversationOps, messageOps } from "../core/db.js";
import { readBody, openSse, sendJson, sendSse } from "./http.js";
import {
  getActiveConversationId,
  normalizeConversationId,
  runConversationChat,
  runTaskInBackground,
  sanitizeTaskName,
  stopConversationChat,
} from "./runtime.js";
import {
  emitConversationEvent,
  subscribeConversation,
  unsubscribeConversation,
} from "./events.js";

initDb();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WEB_DIST = path.join(__dirname, "../gui/dist");

const serveStaticFile = (res, filePath) => {
  const ext = path.extname(filePath);
  const mimeTypes = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
  };
  const contentType = mimeTypes[ext] || "application/octet-stream";

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
    return true;
  } catch {
    return false;
  }
};

const handleStatic = async (req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  let filePath = path.join(WEB_DIST, url.pathname === "/" ? "index.html" : url.pathname);

  if (!fs.existsSync(filePath)) {
    const ext = path.extname(url.pathname);
    if (!ext || ext === "") {
      filePath = path.join(WEB_DIST, "index.html");
    } else {
      sendJson(res, 404, { ok: false, error: "Not found" });
      return;
    }
  }

  const served = serveStaticFile(res, filePath);
  if (!served) {
    sendJson(res, 404, { ok: false, error: "Not found" });
  }
};

const handleChat = async (req, res) => {
  const raw = await readBody(req);
  const body = parseJson(raw || "{}", "server.chat.body");
  const conversationId = normalizeConversationId(body.conversationId);
  void runConversationChat(conversationId, body).catch((error) => {
    if (error?.name === "AbortError") {
      return;
    }
    emitConversationEvent(conversationId, sendSse, "error", {
      ok: false,
      conversationId,
      error: error.message,
    });
  });
  sendJson(res, 202, {
    ok: true,
    accepted: true,
    conversationId,
    message: "chat started",
  });
};

const handleStopChat = async (req, res) => {
  const raw = await readBody(req);
  const body = parseJson(raw || "{}", "server.chat.stop.body");
  const conversationId = normalizeConversationId(body.conversationId);
  const stopped = stopConversationChat(conversationId);
  sendJson(res, 200, {
    ok: true,
    conversationId,
    stopped,
  });
};

const handleConversationStream = async (req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  const conversationId = normalizeConversationId(url.searchParams.get("conversationId"));
  openSse(res);
  subscribeConversation(conversationId, res);
  sendSse(res, "connected", { ok: true, conversationId });
  req.on("close", () => {
    unsubscribeConversation(conversationId, res);
  });
};

const handleTaskCreate = async (req, res) => {
  const raw = await readBody(req);
  const body = parseJson(raw || "{}", "server.task.body");
  const parentConversationId = normalizeConversationId(
    body.parentConversationId || body.conversationId || getActiveConversationId()
  );
  const taskName = sanitizeTaskName(body.name || body.taskName);
  const childConversation = conversationOps.create();
  const childConversationId = childConversation.id;

  const detail = String(body.detail || "").trim();
  const initialMessages = Array.isArray(body.messages)
    ? body.messages
    : detail
      ? [{ role: "user", content: detail }]
      : [];
  if (initialMessages.length === 0) {
    throw new Error("detail is required");
  }
  messageOps.saveBatch(childConversationId, initialMessages);

  void runTaskInBackground({
    parentConversationId,
    childConversationId,
    taskName,
    input: {
      conversationId: childConversationId,
      messages: initialMessages,
      apiUrl: body.apiUrl,
      apiKey: body.apiKey,
      model: body.model,
      system: body.system,
    },
  });

  sendJson(res, 202, {
    ok: true,
    accepted: true,
    parentConversationId,
    taskName,
    childConversationId,
  });
};

const handleGetConversations = async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const page = parseInt(url.searchParams.get("page")) || 1;
    const limit = parseInt(url.searchParams.get("limit")) || 20;
    const search = url.searchParams.get("search") || "";
    const result = conversationOps.list(page, limit, search);
    sendJson(res, 200, { ok: true, ...result });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message });
  }
};

const handleCreateConversation = async (req, res) => {
  try {
    const conversation = conversationOps.create();
    sendJson(res, 201, { ok: true, conversation });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message });
  }
};

const handleDeleteConversation = async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const conversationId = url.pathname.split("/").pop();
    conversationOps.delete(conversationId);
    sendJson(res, 200, { ok: true, message: `Conversation ${conversationId} deleted` });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message });
  }
};

const handleGetMessages = async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const parts = url.pathname.split("/");
    const conversationId = parts[parts.length - 2];
    const page = parseInt(url.searchParams.get("page")) || 1;
    const limit = parseInt(url.searchParams.get("limit")) || 50;
    const order = url.searchParams.get("order") || "asc";
    const result = messageOps.get(conversationId, page, limit, order);
    sendJson(res, 200, { ok: true, ...result });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message });
  }
};

const handleGetConversationStats = async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const parts = url.pathname.split("/");
    const conversationId = parts[parts.length - 2];
    const usage = messageOps.getUsageSummary(conversationId);
    sendJson(res, 200, { ok: true, usage });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message });
  }
};

const handleSearch = async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const query = url.searchParams.get("q") || "";
    const page = parseInt(url.searchParams.get("page")) || 1;
    const limit = parseInt(url.searchParams.get("limit")) || 20;
    const result = messageOps.search(query, page, limit);
    sendJson(res, 200, { ok: true, ...result });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message });
  }
};

const handleRequest = async (req, res, port) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");

  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, { ok: true, port });
    return;
  }
  if (req.method === "POST" && url.pathname === "/chat") {
    await handleChat(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/chat/stop") {
    await handleStopChat(req, res);
    return;
  }
  if (req.method === "GET" && url.pathname === "/conversation/stream") {
    await handleConversationStream(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/task") {
    await handleTaskCreate(req, res);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/conversations") {
    await handleGetConversations(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/conversations") {
    await handleCreateConversation(req, res);
    return;
  }
  if (req.method === "DELETE" && url.pathname.startsWith("/api/conversations/")) {
    await handleDeleteConversation(req, res);
    return;
  }
  if (req.method === "GET" && url.pathname.match(/^\/api\/conversations\/[^/]+\/messages$/)) {
    await handleGetMessages(req, res);
    return;
  }
  if (req.method === "GET" && url.pathname.match(/^\/api\/conversations\/[^/]+\/stats$/)) {
    await handleGetConversationStats(req, res);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/search") {
    await handleSearch(req, res);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/config") {
    sendJson(res, 200, { ok: true, config: serverConfig.get() });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/config") {
    try {
      const raw = await readBody(req);
      const body = parseJson(raw || "{}", "server.config.body");
      serverConfig.set(body);
      sendJson(res, 200, { ok: true, message: "Config saved" });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message });
    }
    return;
  }

  await handleStatic(req, res);
};

export { handleRequest };
