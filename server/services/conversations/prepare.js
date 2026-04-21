import { listMessages } from "../../repository/messages/index.js";
import { getServerConfig } from "../settings/index.js";
import { normalizeConversationId, setActiveConversationId } from "./active.js";
import { buildConversationContext } from "./context.js";

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

const requireConfig = ({ apiUrl, apiKey, model }) => {
  const missing = [];
  if (!apiUrl) missing.push("apiUrl");
  if (!apiKey) missing.push("apiKey");
  if (!model) missing.push("model");
  if (missing.length > 0) {
    throw new Error(`Missing required config: ${missing.join(", ")}`);
  }
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
      if (remainingUserTurns === 0) break;
    }
  }

  if (remainingUserTurns > 0) return messages;
  return messages.slice(startIndex);
};

const injectSystemMessage = (messages, system) => {
  const next = Array.isArray(messages) ? [...messages] : [];
  if (!system) return next;
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

  let contextMessages = Array.isArray(body.messages)
    ? body.messages
    : listMessages(conversationId).messages;

  contextMessages = limitMessagesByTurns(contextMessages, mergedConfig.contextTurns);

  const convContext = buildConversationContext(conversationId, contextMessages);
  const fullSystem = [mergedConfig.system, convContext].filter(Boolean).join("\n\n");

  let messages = injectSystemMessage(contextMessages, fullSystem);
  if (body.prompt) {
    messages = [...messages, { role: "user", content: String(body.prompt) }];
  }

  return { conversationId, config: mergedConfig, messages, contextMessages };
};

export { prepareChatInput };
