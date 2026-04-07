import { spawn } from "child_process";
import { APP_DIR, SERVER_ENTRY } from "./constants.js";

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

export { ensureServer, postChat };
