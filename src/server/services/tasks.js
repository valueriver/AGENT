import { createConversation } from "../repository/conversations.js";
import { saveMessageBatch } from "../repository/messages.js";
import {
  createTaskRow,
  getTask,
  markTaskAborted,
  markTaskDone,
  markTaskError,
  markTaskRunning,
} from "../repository/tasks.js";
import {
  appendMessage,
  runConversationChat,
} from "./conversations.js";

const running = new Map();

const sanitizeTaskName = (taskName) => {
  const value = String(taskName || "").trim();
  if (!value) throw new Error("taskName is required");
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "task";
};

const getLastAssistantMessage = (messages = []) => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "assistant") return messages[index];
  }
  return null;
};

const runTaskInBackground = async ({
  taskId,
  parentConversationId,
  childConversationId,
  taskName,
  input,
}) => {
  const controller = new AbortController();
  running.set(taskId, controller);
  markTaskRunning(taskId);

  try {
    const { result } = await runConversationChat(childConversationId, input, {
      signal: controller.signal,
    });
    const lastAssistant = getLastAssistantMessage(result.messages);
    const summary = lastAssistant?.content || result.text || "";
    markTaskDone(taskId, summary);

    appendMessage(parentConversationId, {
      role: "user",
      content: `[agent:${taskName}][status:done]\nchildConversationId: ${childConversationId}\n${summary}`,
    });
    await runConversationChat(parentConversationId);
  } catch (error) {
    if (error?.name === "AbortError") {
      markTaskAborted(taskId);
      return;
    }
    markTaskError(taskId, error.message);
    appendMessage(parentConversationId, {
      role: "user",
      content: `[agent:${taskName}][status:error]\nchildConversationId: ${childConversationId}\n${error.message}`,
    });
    try {
      await runConversationChat(parentConversationId);
    } catch {
      // Swallow secondary recovery failures to preserve the original task failure signal.
    }
  } finally {
    running.delete(taskId);
  }
};

const createTask = ({ parentConversationId, taskName, detail, messages, inputOverrides = {} }) => {
  const initialMessages = Array.isArray(messages)
    ? messages
    : String(detail || "").trim()
      ? [{ role: "user", content: String(detail).trim() }]
      : [];

  if (initialMessages.length === 0) {
    throw new Error("detail is required");
  }

  const promptText = initialMessages.find((m) => m.role === "user")?.content || "";
  const childTitle = String(promptText).trim().slice(0, 20) || taskName;
  const childConversation = createConversation(childTitle);
  const childConversationId = childConversation.id;

  saveMessageBatch(childConversationId, initialMessages);
  const taskId = createTaskRow({
    parentConversationId,
    childConversationId,
    name: taskName,
    prompt: String(promptText || ""),
  });

  void runTaskInBackground({
    taskId,
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
    taskId,
    parentConversationId,
    taskName,
    childConversationId,
  };
};

const abortTask = (taskId) => {
  const task = getTask(taskId);
  if (!task) throw new Error(`task ${taskId} not found`);
  if (task.status === "done" || task.status === "error" || task.status === "aborted") {
    return task;
  }
  const controller = running.get(taskId);
  if (controller) controller.abort();
  markTaskAborted(taskId);
  return getTask(taskId);
};

export { abortTask, createTask, runTaskInBackground, sanitizeTaskName };
