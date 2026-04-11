import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseJson } from "../core/utils.js";
import { serverConfig } from "../core/config-server.js";
import { initDb, baseOps, messageOps } from "../core/db.js";
import { readBody, openSse, sendJson, sendSse } from "./http.js";
import { getActiveBaseDir, resolveBaseDir, runBaseChat, runTaskInBackground, sanitizeTaskName } from "./runtime.js";
import { emitBaseEvent, subscribeBase, unsubscribeBase } from "./events.js";

initDb();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WEB_DIST = path.join(__dirname, "../web/dist");

// ========== 静态文件服务 ==========
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

// ========== API 路由 ==========
const handleChat = async (req, res) => {
  const raw = await readBody(req);
  const body = parseJson(raw || "{}", "server.chat.body");
  const baseDir = resolveBaseDir(body.baseDir);
  void runBaseChat(baseDir, body).catch((error) => {
    emitBaseEvent(baseDir, sendSse, "error", { ok: false, baseDir, error: error.message });
  });
  sendJson(res, 202, {
    ok: true,
    accepted: true,
    baseDir,
    message: "chat started"
  });
};

const handleBaseStream = async (req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  const baseDir = resolveBaseDir(url.searchParams.get("baseDir"));
  openSse(res);
  subscribeBase(baseDir, res);
  sendSse(res, "connected", { ok: true, baseDir });
  req.on("close", () => {
    unsubscribeBase(baseDir, res);
  });
};

const handleTaskCreate = async (req, res) => {
  const raw = await readBody(req);
  const body = parseJson(raw || "{}", "server.task.body");
  const parentBaseValue = body.parentBaseDir || body.baseDir || getActiveBaseDir();
  if (!parentBaseValue) {
    throw new Error("parent base is required");
  }
  const parentBaseDir = resolveBaseDir(parentBaseValue);
  const taskName = sanitizeTaskName(body.name || body.taskName);
  const childBaseDir = path.join(parentBaseDir, "agent", taskName);
  fs.mkdirSync(childBaseDir, { recursive: true });

  const detail = String(body.detail || "").trim();
  const initialMessages = Array.isArray(body.messages)
    ? body.messages
    : detail
      ? [{ role: "user", content: detail }]
      : [];
  if (initialMessages.length === 0) {
    throw new Error("detail is required");
  }
  messageOps.saveBatch(taskName, initialMessages);

  void runTaskInBackground({
    parentBaseDir,
    childBaseDir,
    taskName,
    input: {
      baseDir: childBaseDir,
      messages: initialMessages,
      apiUrl: body.apiUrl,
      apiKey: body.apiKey,
      model: body.model,
      system: body.system
    }
  });

  sendJson(res, 202, {
    ok: true,
    accepted: true,
    parentBaseDir,
    taskName,
    childBaseDir,
  });
};

// ========== Bases API ==========
const handleGetBases = async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const page = parseInt(url.searchParams.get("page")) || 1;
    const limit = parseInt(url.searchParams.get("limit")) || 20;
    const search = url.searchParams.get("search") || "";
    const result = baseOps.list(page, limit, search);
    sendJson(res, 200, { ok: true, ...result });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message });
  }
};

const handleCreateBase = async (req, res) => {
  try {
    const base = baseOps.create();
    sendJson(res, 201, { ok: true, base });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message });
  }
};

const handleDeleteBase = async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const baseId = url.pathname.split("/").pop();
    baseOps.delete(baseId);
    sendJson(res, 200, { ok: true, message: `Base ${baseId} deleted` });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message });
  }
};

const handleGetMessages = async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const parts = url.pathname.split("/");
    const baseId = parts[parts.length - 2];
    const page = parseInt(url.searchParams.get("page")) || 1;
    const limit = parseInt(url.searchParams.get("limit")) || 50;
    const result = messageOps.get(baseId, page, limit);
    sendJson(res, 200, { ok: true, ...result });
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

// ========== 请求路由 ==========
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
  if (req.method === "GET" && url.pathname === "/base/stream") {
    await handleBaseStream(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/task") {
    await handleTaskCreate(req, res);
    return;
  }

  // Bases API
  if (req.method === "GET" && url.pathname === "/api/bases") {
    await handleGetBases(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/bases") {
    await handleCreateBase(req, res);
    return;
  }
  if (req.method === "DELETE" && url.pathname.startsWith("/api/bases/")) {
    await handleDeleteBase(req, res);
    return;
  }
  if (req.method === "GET" && url.pathname.match(/^\/api\/bases\/[^/]+\/messages$/)) {
    await handleGetMessages(req, res);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/search") {
    await handleSearch(req, res);
    return;
  }

  // Config API
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

  // 静态文件
  await handleStatic(req, res);
};

export { handleRequest };
