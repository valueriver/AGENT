import fs from "fs";
import { spawn } from "child_process";
import { REPO_ROOT, SERVER_ENTRY, SERVER_LOG } from "../runtime.js";
import { request } from "./http.js";

const checkServer = async () => {
  try {
    await request("/health");
    return true;
  } catch {
    return false;
  }
};

const waitForServer = async (timeoutMs) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await checkServer()) return true;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
};

const spawnServer = () => {
  const log = fs.openSync(SERVER_LOG, "a");
  const child = spawn(process.execPath, [SERVER_ENTRY], {
    detached: true,
    stdio: ["ignore", log, log],
    cwd: REPO_ROOT,
  });
  child.unref();
  return child.pid;
};

const ensureServer = async () => {
  if (await checkServer()) return;
  const pid = spawnServer();
  process.stderr.write(`starting agent kernel (pid ${pid})...\n`);
  if (!(await waitForServer(10000))) {
    throw new Error(`failed to start server, see ${SERVER_LOG}`);
  }
};

export { checkServer, ensureServer };
