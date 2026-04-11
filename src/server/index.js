#!/usr/bin/env node

import http from "http";
import { sendJson } from "./http.js";
import { handleRequest } from "./routes.js";

let serverInstance = null;

const startServer = async (port = 9503) => {
  return new Promise((resolve, reject) => {
    serverInstance = http.createServer(async (req, res) => {
      try {
        await handleRequest(req, res, port);
      } catch (error) {
        sendJson(res, 500, { ok: false, error: error.message });
      }
    });

    serverInstance.listen(port, "127.0.0.1", () => {
      console.log(`AGENT server running on http://127.0.0.1:${port}`);
      resolve(serverInstance);
    });

    serverInstance.on("error", reject);
  });
};

const stopServer = async () => {
  if (serverInstance) {
    return new Promise((resolve) => {
      serverInstance.close(() => resolve());
    });
  }
};

// 如果直接运行此文件，启动服务器
if (process.argv[1] && process.argv[1].includes("server/index.js")) {
  const port = Number(process.env.AGENT_PORT) || 9503;
  startServer(port).catch(console.error);
}

export { startServer, stopServer };
