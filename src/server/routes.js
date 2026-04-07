import path from "path";
import { ensureDir, parseJson, saveMessagesFile } from "../core/utils.js";
import { openSse, readBody, sendJson, sendSse } from "./http.js";
import { getActiveBaseDir, resolveBaseDir, resolveMessagesFile, runBaseChat, runTaskInBackground, sanitizeTaskName } from "./runtime.js";
import { emitBaseEvent, subscribeBase, unsubscribeBase } from "./events.js";

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
  await ensureDir(childBaseDir);

  const detail = String(body.detail || "").trim();
  const initialMessages = Array.isArray(body.messages)
    ? body.messages
    : detail
      ? [{ role: "user", content: detail }]
      : [];
  if (initialMessages.length === 0) {
    throw new Error("detail is required");
  }
  await saveMessagesFile(childBaseDir, initialMessages);

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
    messagesFile: resolveMessagesFile(childBaseDir)
  });
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
  if (req.method === "GET" && url.pathname === "/base/stream") {
    await handleBaseStream(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/task") {
    await handleTaskCreate(req, res);
    return;
  }
  sendJson(res, 404, { ok: false, error: "Not found" });
};

export { handleRequest };
