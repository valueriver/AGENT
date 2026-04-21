import { chat } from "../../agent/handler.js";
import {
  createConversation,
  deleteConversation,
  listConversations,
  touchConversation,
} from "../repository/conversations.js";
import {
  appendMessage,
  getConversationUsage,
  listMessages,
  saveMessageBatch,
} from "../repository/messages.js";
import { getServerConfig } from "./config.js";

const CONVERSATION_INFO_START = "<conversation_info>";
const CONVERSATION_INFO_END = "</conversation_info>";

let activeConversationId = "";

const setActiveConversationId = (conversationId) => {
  activeConversationId = String(conversationId || "").trim();
};

const getActiveConversationId = () => activeConversationId;

const normalizeConversationId = (conversationId) => {
  const value = String(conversationId || "").trim();
  if (!/^\d+$/.test(value)) {
    throw new Error(`invalid conversationId: ${conversationId}`);
  }
  return value;
};

const mergeConfig = (input = {}) => {
  const serverCfg = getServerConfig();
  return {
    apiUrl: input.apiUrl || serverCfg.apiUrl || "",
    apiKey: input.apiKey || serverCfg.apiKey || "",
    model: input.model || serverCfg.model || "",
    system: input.system || serverCfg.system || "",
    contextTurns: input.contextTurns ?? serverCfg.contextTurns ?? 10,
  };
};

const limitMessagesByTurns = (messages, contextTurns) => {
  const turns = Math.max(0, Number.parseInt(contextTurns, 10) || 0);
  if (!Array.isArray(messages) || turns === 0) {
    return Array.isArray(messages) ? messages : [];
  }

  let remainingUserTurns = turns;
  let startIndex = 0;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") {
      remainingUserTurns -= 1;
      startIndex = index;
      if (remainingUserTurns === 0) {
        break;
      }
    }
  }

  if (remainingUserTurns > 0) {
    return messages;
  }

  return messages.slice(startIndex);
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

const buildSystemWithConversationInfo = (system, conversationId) => {
  const cleanSystem = String(system || "")
    .replace(new RegExp(`${CONVERSATION_INFO_START}[\\s\\S]*?${CONVERSATION_INFO_END}`, "g"), "")
    .trim();

  const info = `${CONVERSATION_INFO_START}
当前会话信息：
- conversationId: ${conversationId}

工作要求：
- 当前对话历史保存在数据库中
- 创建子任务时优先调用 POST /api/task
- 子任务和主会话都只通过 conversationId 关联
- 处理子任务结果时，优先读取最后一条 assistant 消息
${CONVERSATION_INFO_END}`;

  return cleanSystem ? `${cleanSystem}\n\n${info}` : info;
};

const injectSystemMessage = (messages, system) => {
  const next = Array.isArray(messages) ? [...messages] : [];
  if (next[0]?.role === "system") {
    next[0] = { ...next[0], content: system };
    return next;
  }
  return [{ role: "system", content: system }, ...next];
};

const prepareChatInput = async (body) => {
  const conversationId = normalizeConversationId(body.conversationId);
  setActiveConversationId(conversationId);
  const mergedConfig = mergeConfig(body);
  requireConfig(mergedConfig);

  const runtimeSystem = buildSystemWithConversationInfo(mergedConfig.system, conversationId);
  let contextMessages = Array.isArray(body.messages)
    ? body.messages
    : listMessages(conversationId).messages;

  contextMessages = limitMessagesByTurns(contextMessages, mergedConfig.contextTurns);
  let messages = injectSystemMessage(contextMessages, runtimeSystem);
  if (body.prompt) {
    messages = [...messages, { role: "user", content: String(body.prompt) }];
  }

  return {
    conversationId,
    config: mergedConfig,
    messages,
    contextMessages,
  };
};

const runConversationChat = async (conversationId, input = {}, options = {}) => {
  const prepared = await prepareChatInput({ ...input, conversationId });
  const { onEvent, signal } = options;
  onEvent?.({ type: "start", ok: true, conversationId });

  try {
    const result = await chat(prepared.messages, {
      ...prepared.config,
      signal,
      onEvent: (event) => {
        onEvent?.(event);
      },
    });

    const persistedMessages = result.messages
      .filter((message) => message.role !== "system")
      .slice(prepared.contextMessages.length);

    if (persistedMessages.length > 0) {
      saveMessageBatch(conversationId, persistedMessages);
    }
    touchConversation(conversationId);

    onEvent?.({ type: "saved", ok: true, conversationId });
    onEvent?.({ type: "end", ok: true, conversationId });
    return { result, storage: "sqlite" };
  } catch (error) {
    if (error?.name === "AbortError") {
      onEvent?.({
        type: "stopped",
        ok: true,
        conversationId,
      });
    }
    throw error;
  }
};

export {
  appendMessage,
  createConversation,
  deleteConversation,
  getActiveConversationId,
  getConversationUsage,
  listConversations,
  listMessages,
  normalizeConversationId,
  prepareChatInput,
  runConversationChat,
};
