import path from "path";
import { fileURLToPath } from "url";
import { chat } from "../agent/handler.js";
import { serverConfig } from "../core/config-server.js";
import { initDb, messageOps, baseOps } from "../core/db.js";
import { emitBaseEvent } from "./events.js";
import { sendSse } from "./http.js";

initDb();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(__dirname, "..", "..");
const BASES_DIR = path.join(APP_DIR, "bases");
const BASE_INFO_START = "<base_info>";
const BASE_INFO_END = "</base_info>";
let activeBaseDir = "";

const setActiveBaseDir = (baseDir) => {
  activeBaseDir = baseDir;
};

const getActiveBaseDir = () => activeBaseDir;

const resolveBaseDir = (baseDir) => {
  const value = String(baseDir || "").trim();
  if (!value) throw new Error("baseDir is required");
  if (/^\d+$/.test(value)) {
    return path.join(BASES_DIR, value);
  }
  return path.isAbsolute(value) ? value : path.join(APP_DIR, value);
};

const mergeConfig = (input = {}) => {
  const serverCfg = serverConfig.get();
  return {
    apiUrl: input.apiUrl || serverCfg.apiUrl || "",
    apiKey: input.apiKey || serverCfg.apiKey || "",
    model: input.model || serverCfg.model || "",
    system: input.system || serverCfg.system || ""
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
  const baseName = path.basename(baseDir);
  const cleanSystem = String(system || "")
    .replace(new RegExp(`${BASE_INFO_START}[\\s\\S]*?${BASE_INFO_END}`, "g"), "")
    .trim();

  const baseInfo = `${BASE_INFO_START}
当前 base 信息：
- baseName: ${baseName}
- baseDir: ${baseDir}

工作要求：
- 当前对话历史保存在数据库中
- 如果要启动新的 agent，必须使用这个目录模式：${baseDir}/agent/<taskName>/
- 处理子 agent 结果时，优先读取对应 messages 的最后一条 assistant 消息
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

const sanitizeTaskName = (taskName) => {
  const value = String(taskName || "").trim();
  if (!value) throw new Error("taskName is required");
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "task";
};

const prepareChatInput = async (body) => {
  const baseDir = resolveBaseDir(body.baseDir);
  setActiveBaseDir(baseDir);
  const mergedConfig = mergeConfig(body);
  requireConfig(mergedConfig);

  const runtimeSystem = buildSystemWithBaseInfo(mergedConfig.system, baseDir);
  let messages = Array.isArray(body.messages)
    ? body.messages
    : messageOps.get(baseDir);

  messages = injectSystemMessage(messages, runtimeSystem);
  if (body.prompt) {
    messages = [...messages, { role: "user", content: String(body.prompt) }];
  }
  return {
    baseDir,
    config: mergedConfig,
    messages
  };
};

const runBaseChat = async (baseDir, input = {}, onEvent) => {
  const { config: mergedConfig, messages } = await prepareChatInput({
    ...input,
    baseDir
  });
  emitBaseEvent(baseDir, sendSse, "start", { ok: true, baseDir });

  const result = await chat(messages, {
    ...mergedConfig,
    onEvent: (event) => {
      emitBaseEvent(baseDir, sendSse, event.type, event);
      onEvent?.(event);
    }
  });

  // 保存到数据库
  messageOps.saveBatch(baseDir, result.messages);
  baseOps.update(baseDir);

  emitBaseEvent(baseDir, sendSse, "saved", { ok: true, baseDir });
  emitBaseEvent(baseDir, sendSse, "end", { ok: true, baseDir });
  return { result, messagesFile: "sqlite" };
};

const getLastAssistantMessage = (messages) => {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant") return messages[i];
  }
  return null;
};

const runTaskInBackground = async ({ parentBaseDir, childBaseDir, taskName, input }) => {
  try {
    const { result } = await runBaseChat(childBaseDir, input);
    const lastAssistant = getLastAssistantMessage(result.messages);
    const summary = lastAssistant?.content || result.text || "";

    messageOps.append(parentBaseDir, {
      role: "user",
      content: `[agent:${taskName}][status:done]\nchildBaseDir: ${childBaseDir}\n${summary}`
    });
    await runBaseChat(parentBaseDir);
  } catch (error) {
    messageOps.append(parentBaseDir, {
      role: "user",
      content: `[agent:${taskName}][status:error]\nchildBaseDir: ${childBaseDir}\n${error.message}`
    });
    try {
      await runBaseChat(parentBaseDir);
    } catch {}
  }
};

export { getActiveBaseDir, prepareChatInput, resolveBaseDir, runBaseChat, runTaskInBackground, sanitizeTaskName };
