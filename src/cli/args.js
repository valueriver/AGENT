import process from "process";
import { DEFAULT_SERVER_URL } from "./constants.js";

const printHelp = () => {
  process.stdout.write(`agent CLI

Usage:
  agent
  agent [prompt]
  agent -1
  agent 3
  agent --config <apiUrl> <apiKey> <model>
  agent --server http://127.0.0.1:9503

Options:
  --server <url>       Agent service URL
  --api-url <url>      Chat completions endpoint
  --api-key <key>      API key
  --model <name>       Model name
  --config ...         Save apiUrl/apiKey/model to ~/.config/agent-cli/config.env
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
    baseRef: "",
    configValues: []
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
    if (arg === "--config") {
      options.configValues = [
        argv[++i] || "",
        argv[++i] || "",
        argv[++i] || ""
      ];
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

export { parseArgs, printHelp };
