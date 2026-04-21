#!/usr/bin/env node

import readline from "readline";

const SERVER_URL = process.env.AGENT_SERVER_URL || "http://127.0.0.1:9500";

const request = async (pathname, options = {}) => {
  const res = await fetch(`${SERVER_URL}${pathname}`, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `${res.status} ${res.statusText}`);
  }
  return data;
};

const checkServer = async () => {
  try {
    await request("/health");
    return true;
  } catch {
    return false;
  }
};

const createConversation = async () => {
  const res = await request("/api/conversations", { method: "POST" });
  return res.conversation?.id;
};

const readSseResponse = async (res) => {
  if (!res.ok || !res.body) {
    throw new Error(`stream failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let assistantLineOpen = false;

  const flushLine = () => {
    if (assistantLineOpen) {
      process.stdout.write("\n");
      assistantLineOpen = false;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    let sep = buffer.indexOf("\n\n");
    while (sep >= 0) {
      const event = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      sep = buffer.indexOf("\n\n");

      const lines = event.split("\n").filter(Boolean);
      const eventName = lines.find((line) => line.startsWith("event:"))?.slice(6).trim();
      const payloadRaw = lines
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("\n");

      if (!eventName || !payloadRaw) continue;
      const payload = JSON.parse(payloadRaw);

      if (eventName === "delta") {
        assistantLineOpen = true;
        process.stdout.write(payload.delta || "");
        continue;
      }

      if (eventName === "tool_call") {
        flushLine();
        const toolName = payload.toolCall?.function?.name || "tool";
        process.stdout.write(`\n[tool] ${toolName}\n`);
        continue;
      }

      if (eventName === "tool_result") {
        flushLine();
        const content = payload.message?.content || "";
        process.stdout.write(`[tool-result]\n${content}\n`);
        continue;
      }

      if (eventName === "error") {
        flushLine();
        throw new Error(payload.error || "stream error");
      }

      if (eventName === "end" || eventName === "stopped") {
        flushLine();
        return;
      }
    }
  }
};

const runChatTurn = async (conversationId, prompt) => {
  const res = await fetch(`${SERVER_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId, prompt }),
  });
  await readSseResponse(res);
};

const commandConfig = async (args) => {
  const action = args[0] || "get";
  if (action === "get") {
    const res = await request("/api/config");
    process.stdout.write(`${JSON.stringify(res.config || {}, null, 2)}\n`);
    return;
  }

  if (action === "set") {
    const next = {};
    for (const pair of args.slice(1)) {
      const idx = pair.indexOf("=");
      if (idx <= 0) continue;
      next[pair.slice(0, idx)] = pair.slice(idx + 1);
    }
    await request("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    process.stdout.write("config saved\n");
    return;
  }

  throw new Error(`unknown config action: ${action}`);
};

const commandChat = async (args) => {
  const prompt = args.join(" ").trim();
  if (!prompt) {
    throw new Error("chat message is required");
  }
  const conversationId = await createConversation();
  process.stdout.write(`conversation ${conversationId}\n`);
  await runChatTurn(conversationId, prompt);
};

const commandRepl = async () => {
  const conversationId = await createConversation();
  process.stdout.write(`conversation ${conversationId}\n`);
  process.stdout.write("输入消息开始对话，输入 /exit 退出。\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "> ",
  });

  rl.prompt();
  rl.on("line", async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }
    if (input === "/exit" || input === "/quit") {
      rl.close();
      return;
    }

    rl.pause();
    try {
      await runChatTurn(conversationId, input);
    } catch (error) {
      process.stderr.write(`error: ${error.message}\n`);
    } finally {
      rl.resume();
      rl.prompt();
    }
  });
};

const main = async () => {
  if (!(await checkServer())) {
    throw new Error(`server unavailable at ${SERVER_URL}, start it with: npm start`);
  }

  const [command = "repl", ...args] = process.argv.slice(2);
  if (command === "repl") {
    await commandRepl();
    return;
  }
  if (command === "chat") {
    await commandChat(args);
    return;
  }
  if (command === "config") {
    await commandConfig(args);
    return;
  }
  if (command === "health") {
    const res = await request("/health");
    process.stdout.write(`${JSON.stringify(res, null, 2)}\n`);
    return;
  }

  throw new Error(`unknown command: ${command}`);
};

main().catch((error) => {
  process.stderr.write(`error: ${error.message}\n`);
  process.exitCode = 1;
});
