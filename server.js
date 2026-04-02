#!/usr/bin/env node

import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { chat } from "./agent/handler.js";
import config from "./config.js";
import { ensureDir, loadMessagesFile, parseJson, resolveMessagesFile, saveMessagesFile } from "./utils.js";

const APP_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PORT = 9503;
const BASE_INFO_START = "<base_info>";
const BASE_INFO_END = "</base_info>";

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(`${JSON.stringify(payload, null, 2)}\n`);
};

const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
};

const resolveBaseDir = (baseDir) => {
  const value = String(baseDir || "").trim();
  if (!value) throw new Error("baseDir is required");
  return path.isAbsolute(value) ? value : path.join(APP_DIR, value);
};

const mergeConfig = (input = {}) => {
  const envApiUrl = process.env.AGENT_API_URL || "";
  const envApiKey = process.env.AGENT_API_KEY || process.env.OPENAI_API_KEY || "";
  const envModel = process.env.AGENT_MODEL || "";

  return {
    apiUrl: input.apiUrl || config.apiUrl || envApiUrl || "",
    apiKey: input.apiKey || config.apiKey || envApiKey || "",
    model: input.model || config.model || envModel || "",
    system: input.system || config.system || ""
  };
};

const requireConfig = ({ apiUrl, apiKey, model }) => {
  const missing = [];
  if (!apiUrl) missing.push("apiUrl");
  if (!apiKey) missing.push("apiKey");
  if (!model) missing.push("model");
  if (missing.length > 0) {
    throw new Error(`Missing required config: ${missing.join(", ")}`);
  }
};

const buildSystemWithBaseInfo = (system, baseDir) => {
  const messagesFile = resolveMessagesFile(baseDir);
  const baseName = path.basename(baseDir);
  const cleanSystem = String(system || "")
    .replace(new RegExp(`${BASE_INFO_START}[\\s\\S]*?${BASE_INFO_END}`, "g"), "")
    .trim();

  const baseInfo = `${BASE_INFO_START}
当前 base 信息：
- baseName: ${baseName}
- baseDir: ${baseDir}
- messagesPath: ${messagesFile}

工作要求：
- 当前对话历史保存在上述 messagesPath
- 如果要启动新的 agent，必须使用这个目录模式：${baseDir}/agent/<taskName>/messages.json
- 处理子 agent 结果时，优先读取对应 messages.json 的最后一条 assistant 消息
${BASE_INFO_END}`;

  return cleanSystem ? `${cleanSystem}\n\n${baseInfo}` : baseInfo;
};

const injectSystemMessage = (messages, system) => {
  const next = Array.isArray(messages) ? [...messages] : [];
  if (next[0]?.role === "system") {
    next[0] = { ...next[0], content: system };
    return next;
  }
  return [{ role: "system", content: system }, ...next];
};

const handleChat = async (req, res) => {
  const raw = await readBody(req);
  const body = parseJson(raw || "{}", "server.chat.body");
  const baseDir = resolveBaseDir(body.baseDir);
  const config = mergeConfig(body);
  requireConfig(config);
  await ensureDir(baseDir);
  const runtimeSystem = buildSystemWithBaseInfo(config.system, baseDir);

  let messages = Array.isArray(body.messages) ? body.messages : await loadMessagesFile(baseDir, runtimeSystem);
  messages = injectSystemMessage(messages, runtimeSystem);
  if (body.prompt) {
    messages = [...messages, { role: "user", content: String(body.prompt) }];
  }

  const result = await chat(messages, config);
  const messagesFile = await saveMessagesFile(baseDir, result.messages);
  sendJson(res, 200, {
    ok: true,
    baseDir,
    messagesFile,
    text: result.text,
    messages: result.messages
  });
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, { ok: true, port: DEFAULT_PORT });
      return;
    }
    if (req.method === "POST" && url.pathname === "/chat") {
      await handleChat(req, res);
      return;
    }
    sendJson(res, 404, { ok: false, error: "Not found" });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message });
  }
});

server.listen(DEFAULT_PORT, "127.0.0.1", () => {
  process.stdout.write(`agent server listening on http://127.0.0.1:${DEFAULT_PORT}\n`);
});
