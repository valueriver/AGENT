import { startServer } from "./src/server/index.js";

const port = Number(process.env.AGENT_PORT) || 9503;

console.log(`Starting AGENT server on port ${port}...`);
await startServer(port);
