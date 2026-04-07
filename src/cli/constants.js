import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const BASES_DIR = path.join(APP_DIR, "bases");
const DEFAULT_SERVER_URL = "http://127.0.0.1:9503";
const SERVER_ENTRY = path.join(APP_DIR, "src", "server", "index.js");
const DEFAULT_CONFIG_DIR = path.join(os.homedir(), ".config", "agent-cli");
const DEFAULT_CONFIG_FILE = path.join(DEFAULT_CONFIG_DIR, "config.env");

export {
  APP_DIR,
  BASES_DIR,
  DEFAULT_CONFIG_DIR,
  DEFAULT_CONFIG_FILE,
  DEFAULT_SERVER_URL,
  SERVER_ENTRY
};
