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
const SERVER_ENTRY = path.join(APP_DIR, "server.js");
const ANSI_RESET = "\x1b[0m";
const ANSI_CYAN = "\x1b[36m";
const ANSI_GREEN = "\x1b[32m";
const YOU_PREFIX = `${ANSI_CYAN}you>${ANSI_RESET} `;
const ASSISTANT_PREFIX = `${ANSI_GREEN}assistant>${ANSI_RESET} `;

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
  process.stdout.write(`${ASSISTANT_PREFIX}思考中...\n`);
};

const renderMarkdown = (text) => marked.parse(String(text ?? "")).trimEnd();

const replaceThinkingWithReply = (text) => {
  process.stdout.write("\x1b[1A");
  process.stdout.write("\x1b[2K");
  process.stdout.write("\r");
  process.stdout.write(`${ASSISTANT_PREFIX}\n`);
  process.stdout.write(`${renderMarkdown(text)}\n`);
};

const runSingle = async (config, prompt, base) => {
  showThinking();
  const result = await postChat(config, {
    baseDir: base.baseDir,
    system: base.systemPrompt,
    prompt
  });
  replaceThinkingWithReply(result.text);
};

const runRepl = async (config, base) => {
  const rl = readline.createInterface({ input, output });
  process.stdout.write(`Interactive agent CLI. Base #${base.baseId}. Type /exit to quit.\n`);

  try {
    while (true) {
      const prompt = (await rl.question(`\n${YOU_PREFIX}`)).trim();
      if (!prompt) continue;
      if (prompt === "/exit" || prompt === "/quit") break;
      rl.pause();
      showThinking();
      try {
        const result = await postChat(config, {
          baseDir: base.baseDir,
          system: base.systemPrompt,
          prompt
        });
        replaceThinkingWithReply(result.text);
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
