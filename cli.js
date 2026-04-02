#!/usr/bin/env node

import process from "process";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { mkdir, readdir } from "fs/promises";
import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { marked } from "marked";
import { markedTerminal } from "marked-terminal";
import config from "./config.js";

const APP_DIR = path.dirname(fileURLToPath(import.meta.url));
const BASES_DIR = path.join(APP_DIR, "bases");
const DEFAULT_SERVER_URL = "http://127.0.0.1:9503";
const SERVER_ENTRY = path.join(APP_DIR, "server", "index.js");
const ANSI_RESET = "\x1b[0m";
const ANSI_CYAN = "\x1b[36m";
const ANSI_GREEN = "\x1b[32m";
const ANSI_MAGENTA = "\x1b[35m";
const ANSI_YELLOW = "\x1b[33m";
const ANSI_GRAY = "\x1b[90m";
const ANSI_BOLD = "\x1b[1m";
const YOU_PREFIX = `${ANSI_CYAN}you${ANSI_RESET}`;
const ASSISTANT_PREFIX = `${ANSI_GREEN}assistant${ANSI_RESET}`;
const AGENT_PREFIX = `${ANSI_MAGENTA}agent${ANSI_RESET}`;
const TOOL_CALL_PREFIX = `${ANSI_MAGENTA}[tool call]${ANSI_RESET}`;
const TOOL_RESULT_PREFIX = `${ANSI_YELLOW}[tool result]${ANSI_RESET}`;

marked.use(markedTerminal({
  reflowText: true,
  width: 100
}));

const printHelp = () => {
  process.stdout.write(`agent CLI

Usage:
  node cli.js [prompt]
  node cli.js -1
  node cli.js 3
  node cli.js --server http://127.0.0.1:9503

Options:
  --server <url>       Agent service URL
  --api-url <url>      Chat completions endpoint
  --api-key <key>      API key
  --model <name>       Model name
  --system <text>      System prompt
  --cwd <path>         Change working directory before start
  --help               Show this help

Env:
  AGENT_API_URL
  AGENT_API_KEY
  AGENT_MODEL
  OPENAI_API_KEY
`);
};

const parseArgs = (argv) => {
  const options = {
    serverUrl: process.env.AGENT_SERVER_URL || DEFAULT_SERVER_URL,
    apiUrl: "",
    apiKey: "",
    model: "",
    system: "",
    cwd: "",
    baseRef: ""
  };
  const promptParts = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--server") {
      options.serverUrl = argv[++i] || "";
      continue;
    }
    if (arg === "--api-url") {
      options.apiUrl = argv[++i] || "";
      continue;
    }
    if (arg === "--api-key") {
      options.apiKey = argv[++i] || "";
      continue;
    }
    if (arg === "--model") {
      options.model = argv[++i] || "";
      continue;
    }
    if (arg === "--system") {
      options.system = argv[++i] || "";
      continue;
    }
    if (arg === "--cwd") {
      options.cwd = argv[++i] || "";
      continue;
    }
    if (!options.baseRef && promptParts.length === 0 && /^-?\d+$/.test(arg)) {
      options.baseRef = arg;
      continue;
    }
    promptParts.push(arg);
  }

  return { options, prompt: promptParts.join(" ").trim() };
};

const mergeConfig = (cliOptions) => {
  const envApiUrl = process.env.AGENT_API_URL || "";
  const envApiKey = process.env.AGENT_API_KEY || process.env.OPENAI_API_KEY || "";
  const envModel = process.env.AGENT_MODEL || "";

  return {
    serverUrl: cliOptions.serverUrl || DEFAULT_SERVER_URL,
    apiUrl: cliOptions.apiUrl || config.apiUrl || envApiUrl || "",
    apiKey: cliOptions.apiKey || config.apiKey || envApiKey || "",
    model: cliOptions.model || config.model || envModel || "",
    system: cliOptions.system || config.system || "",
    cwd: cliOptions.cwd
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

const sleep = async (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const checkServerHealth = async (serverUrl) => {
  try {
    const res = await fetch(`${serverUrl}/health`);
    return res.ok;
  } catch {
    return false;
  }
};

const ensureServer = async (serverUrl) => {
  const healthy = await checkServerHealth(serverUrl);
  if (healthy) return;

  const child = spawn(process.execPath, [SERVER_ENTRY], {
    cwd: APP_DIR,
    detached: true,
    stdio: "ignore"
  });
  child.unref();

  for (let i = 0; i < 20; i += 1) {
    await sleep(200);
    if (await checkServerHealth(serverUrl)) {
      return;
    }
  }

  throw new Error(`Agent server failed to start: ${serverUrl}`);
};

const listBaseIds = async () => {
  await mkdir(BASES_DIR, { recursive: true });
  const entries = await readdir(BASES_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
    .map((entry) => Number(entry.name))
    .filter((value) => Number.isInteger(value) && value > 0)
    .sort((a, b) => a - b);
};

const resolveBaseId = async (baseRef) => {
  const ids = await listBaseIds();
  if (!baseRef) {
    return (ids.at(-1) || 0) + 1;
  }
  if (baseRef === "-1") {
    const latest = ids.at(-1);
    if (!latest) {
      throw new Error("No bases found");
    }
    return latest;
  }
  const id = Number(baseRef);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`Invalid base id: ${baseRef}`);
  }
  return id;
};

const openBase = async (baseRef, systemPrompt) => {
  const baseId = await resolveBaseId(baseRef);
  const dir = path.join(BASES_DIR, String(baseId));
  await mkdir(dir, { recursive: true });
  return {
    baseId,
    baseDir: dir,
    systemPrompt
  };
};

const postChat = async (config, payload) => {
  const res = await fetch(`${config.serverUrl}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      apiUrl: config.apiUrl,
      apiKey: config.apiKey,
      model: config.model
    })
  });
  const json = await res.json();
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || `Server ${res.status}`);
  }
  return json;
};

const showThinking = () => {
  printLine(ASSISTANT_PREFIX, "思考中...");
};

const renderMarkdown = (text) => marked.parse(String(text ?? "")).trimEnd();

const truncateText = (text, maxChars = 200) => {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}...`;
};

const formatGray = (text) => `${ANSI_GRAY}${text}${ANSI_RESET}`;

const printLine = (prefix, content = "") => {
  process.stdout.write(`${prefix}${content ? ` ${content}` : ""}\n`);
};

const printBlock = (prefix, content = "") => {
  process.stdout.write(`${prefix}\n`);
  if (content) {
    process.stdout.write(`${content}\n`);
  }
};

const parseToolArgs = (toolCall) => {
  const raw = toolCall?.function?.arguments || "";
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const replaceThinkingWithReply = (text) => {
  process.stdout.write("\x1b[1A");
  process.stdout.write("\x1b[2K");
  process.stdout.write("\r");
  printBlock(ASSISTANT_PREFIX, renderMarkdown(text));
};

const clearThinking = () => {
  process.stdout.write("\x1b[1A");
  process.stdout.write("\x1b[2K");
  process.stdout.write("\r");
};

const createStreamPrinter = ({ onIdlePrompt } = {}) => {
  let thinkingVisible = false;
  let pendingResolve = null;
  let pendingReject = null;
  return {
    beginTurn() {
      thinkingVisible = true;
      showThinking();
      return new Promise((resolve, reject) => {
        pendingResolve = resolve;
        pendingReject = reject;
      });
    },
    handle(event, data) {
      if (event === "connected") {
        return;
      }
      if (event === "start") {
        return;
      }
      if (event === "tool_call") {
        if (thinkingVisible) {
          clearThinking();
          thinkingVisible = false;
        }
        const args = parseToolArgs(data?.toolCall);
        const reason = truncateText(args.reason || "");
        const command = truncateText(args.command || data?.toolCall?.function?.arguments || "");
        printLine(TOOL_CALL_PREFIX, reason ? `${ANSI_BOLD}${reason}${ANSI_RESET}` : "");
        if (command) {
          process.stdout.write(`${formatGray(command)}\n`);
        }
      }
      if (event === "tool_result") {
        if (thinkingVisible) {
          clearThinking();
          thinkingVisible = false;
        }
        const content = truncateText(data?.message?.content || "");
        printLine(TOOL_RESULT_PREFIX);
        process.stdout.write(`${formatGray(content)}\n`);
      }
      if (event === "done") {
        const text = data?.text || "";
        const hadPendingTurn = Boolean(pendingResolve);
        if (thinkingVisible) {
          replaceThinkingWithReply(text);
          thinkingVisible = false;
        } else {
          printLine(AGENT_PREFIX);
          printBlock(ASSISTANT_PREFIX, renderMarkdown(text));
        }
        pendingResolve?.(text);
        pendingResolve = null;
        pendingReject = null;
        if (!hadPendingTurn) {
          onIdlePrompt?.();
        }
      }
      if (event === "error") {
        const error = new Error(data?.error || "base stream error");
        const hadPendingTurn = Boolean(pendingReject);
        if (thinkingVisible) {
          clearThinking();
          thinkingVisible = false;
        }
        pendingReject?.(error);
        pendingResolve = null;
        pendingReject = null;
        if (!hadPendingTurn) {
          onIdlePrompt?.();
        }
      }
    }
  };
};

const startBaseStream = async (config, base, printer) => {
  const res = await fetch(`${config.serverUrl}/base/stream?baseDir=${encodeURIComponent(base.baseDir)}`);
  if (!res.ok || !res.body) {
    const text = await res.text();
    throw new Error(text || `Server ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  (async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep = buffer.indexOf("\n\n");
      while (sep >= 0) {
        const chunk = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        sep = buffer.indexOf("\n\n");
        const lines = chunk.split("\n");
        const eventLine = lines.find((line) => line.startsWith("event:"));
        const dataLines = lines.filter((line) => line.startsWith("data:"));
        if (!eventLine || dataLines.length === 0) continue;
        const event = eventLine.slice(6).trim();
        const data = JSON.parse(dataLines.map((line) => line.slice(5).trim()).join("\n"));
        printer.handle(event, data);
      }
    }
  })().catch((error) => {
    printer.handle("error", { error: error.message });
  });
};

const runSingle = async (config, prompt, base) => {
  const printer = createStreamPrinter();
  await startBaseStream(config, base, printer);
  const wait = printer.beginTurn();
  await postChat(config, {
    baseDir: base.baseDir,
    system: base.systemPrompt,
    prompt
  });
  await wait;
};

const runRepl = async (config, base) => {
  const rl = readline.createInterface({ input, output });
  const printer = createStreamPrinter({
    onIdlePrompt: () => {
      process.stdout.write(`\n${YOU_PREFIX} `);
    }
  });
  await startBaseStream(config, base, printer);
  process.stdout.write(`Interactive agent CLI. Base #${base.baseId}. Type /exit to quit.\n`);

  try {
    while (true) {
      const prompt = (await rl.question(`\n${YOU_PREFIX} `)).trim();
      if (!prompt) continue;
      if (prompt === "/exit" || prompt === "/quit") break;
      rl.pause();
      try {
        const wait = printer.beginTurn();
        await postChat(config, {
          baseDir: base.baseDir,
          system: base.systemPrompt,
          prompt
        });
        await wait;
      } finally {
        rl.resume();
      }
    }
  } finally {
    rl.close();
  }
};

const main = async () => {
  const { options: rawOptions, prompt } = parseArgs(process.argv.slice(2));
  if (rawOptions.help) {
    printHelp();
    return;
  }
  const options = mergeConfig(rawOptions);
  if (options.cwd) {
    process.chdir(options.cwd);
  }
  requireConfig(options);
  await ensureServer(options.serverUrl);
  const base = await openBase(rawOptions.baseRef, options.system);

  if (prompt) {
    await runSingle(options, prompt, base);
    return;
  }
  await runRepl(options, base);
};

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
