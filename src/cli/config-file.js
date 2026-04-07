import process from "process";
import { mkdir, writeFile } from "fs/promises";
import config from "../core/config.js";
import { DEFAULT_CONFIG_DIR, DEFAULT_CONFIG_FILE, DEFAULT_SERVER_URL } from "./constants.js";

const escapeEnvValue = (value) => String(value ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');

const saveConfigFile = async ([apiUrl, apiKey, model]) => {
  if (!apiUrl || !apiKey || !model) {
    throw new Error("Usage: agent --config <apiUrl> <apiKey> <model>");
  }

  await mkdir(DEFAULT_CONFIG_DIR, { recursive: true });
  const content = [
    `AGENT_API_URL="${escapeEnvValue(apiUrl)}"`,
    `OPENAI_API_KEY="${escapeEnvValue(apiKey)}"`,
    `AGENT_MODEL="${escapeEnvValue(model)}"`,
    ""
  ].join("\n");
  await writeFile(DEFAULT_CONFIG_FILE, content, "utf8");
  process.stdout.write(`Config saved: ${DEFAULT_CONFIG_FILE}\n`);
  process.stdout.write("Next: run `agent`\n");
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

export { mergeConfig, requireConfig, saveConfigFile };
