#!/usr/bin/env node

import { main } from "../src/cli/index.js";

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
