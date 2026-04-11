import path from "path";
import { mkdir, readFile, writeFile } from "fs/promises";

const parseJson = (raw, label = "json") => {
  const input = String(raw ?? "");
  if (!input) {
    throw new Error(`Invalid JSON in ${label}: empty input`);
  }
  try {
    return JSON.parse(input);
  } catch (error) {
    throw new Error(`Invalid JSON in ${label}: ${error.message}`);
  }
};

const ensureDir = async (dir) => {
  await mkdir(dir, { recursive: true });
};

const resolveMessagesFile = (baseDir) => {
  return path.join(baseDir, "messages.json");
};

const loadMessagesFile = async (baseDir, systemPrompt = "") => {
  const messagesFile = resolveMessagesFile(baseDir);
  try {
    const raw = await readFile(messagesFile, "utf8");
    const messages = JSON.parse(raw);
    if (Array.isArray(messages)) {
      return messages;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return systemPrompt ? [{ role: "system", content: systemPrompt }] : [];
};

const saveMessagesFile = async (baseDir, messages) => {
  await ensureDir(baseDir);
  const messagesFile = resolveMessagesFile(baseDir);
  await writeFile(messagesFile, `${JSON.stringify(messages, null, 2)}\n`, "utf8");
  return messagesFile;
};

const appendMessageToBase = async (baseDir, message) => {
  const messages = await loadMessagesFile(baseDir);
  messages.push(message);
  await saveMessagesFile(baseDir, messages);
  return messages;
};

const getLastAssistantMessage = (messages = []) => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === "assistant") {
      return messages[i];
    }
  }
  return null;
};

export { appendMessageToBase, ensureDir, getLastAssistantMessage, loadMessagesFile, parseJson, resolveMessagesFile, saveMessagesFile };
