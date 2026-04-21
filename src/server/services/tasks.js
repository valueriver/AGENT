import { createConversation } from "../repository/conversations.js";
import { saveMessageBatch } from "../repository/messages.js";
import {
  appendMessage,
  runConversationChat,
} from "./conversations.js";

const sanitizeTaskName = (taskName) => {
  const value = String(taskName || "").trim();
  if (!value) throw new Error("taskName is required");
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "task";
};

const getLastAssistantMessage = (messages = []) => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "assistant") {
      return messages[index];
    }
  }
  return null;
};

const runTaskInBackground = async ({ parentConversationId, childConversationId, taskName, input }) => {
  try {
    const { result } = await runConversationChat(childConversationId, input);
    const lastAssistant = getLastAssistantMessage(result.messages);
    const summary = lastAssistant?.content || result.text || "";

    appendMessage(parentConversationId, {
      role: "user",
      content: `[agent:${taskName}][status:done]\nchildConversationId: ${childConversationId}\n${summary}`,
    });
    await runConversationChat(parentConversationId);
  } catch (error) {
    appendMessage(parentConversationId, {
      role: "user",
      content: `[agent:${taskName}][status:error]\nchildConversationId: ${childConversationId}\n${error.message}`,
    });
    try {
      await runConversationChat(parentConversationId);
    } catch {
      // Swallow secondary recovery failures to preserve the original task failure signal.
    }
  }
};

const createTask = ({ parentConversationId, taskName, detail, messages, inputOverrides = {} }) => {
  const childConversation = createConversation();
  const childConversationId = childConversation.id;
  const initialMessages = Array.isArray(messages)
    ? messages
    : String(detail || "").trim()
      ? [{ role: "user", content: String(detail).trim() }]
      : [];

  if (initialMessages.length === 0) {
    throw new Error("detail is required");
  }

  saveMessageBatch(childConversationId, initialMessages);

  void runTaskInBackground({
    parentConversationId,
    childConversationId,
    taskName,
    input: {
      conversationId: childConversationId,
      messages: initialMessages,
      ...inputOverrides,
    },
  });

  return {
    parentConversationId,
    taskName,
    childConversationId,
  };
};

export { createTask, runTaskInBackground, sanitizeTaskName };
