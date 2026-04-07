import process from "process";
import { parseArgs, printHelp } from "./args.js";
import { openBase } from "./base.js";
import { mergeConfig, requireConfig, saveConfigFile } from "./config-file.js";
import { ensureServer } from "./server.js";
import { runRepl, runSingle } from "./session.js";

const main = async () => {
  const { options: rawOptions, prompt } = parseArgs(process.argv.slice(2));
  if (rawOptions.help) {
    printHelp();
    return;
  }
  if (rawOptions.configValues.length > 0) {
    await saveConfigFile(rawOptions.configValues);
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

export { main };
