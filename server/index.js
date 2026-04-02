#!/usr/bin/env node

import http from "http";
import { sendJson } from "./http.js";
import { handleRequest } from "./routes.js";

const DEFAULT_PORT = 9503;

const server = http.createServer(async (req, res) => {
  try {
    await handleRequest(req, res, DEFAULT_PORT);
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message });
  }
});

server.listen(DEFAULT_PORT, "127.0.0.1", () => {
  process.stdout.write(`agent server listening on http://127.0.0.1:${DEFAULT_PORT}\n`);
});
