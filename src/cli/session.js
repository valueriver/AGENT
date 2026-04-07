import process from "process";
import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { createStreamPrinter, YOU_PREFIX } from "./printer.js";
import { postChat } from "./server.js";
import { startBaseStream } from "./stream.js";

const runSingle = async (config, prompt, base) => {
  const printer = createStreamPrinter();
  await startBaseStream(config, base, printer);
  const wait = printer.beginTurn();
  await postChat(config, {
    baseDir: base.baseDir,
    system: base.systemPrompt,
    prompt
  });
  await wait;
};

const runRepl = async (config, base) => {
  const rl = readline.createInterface({ input, output });
  const printer = createStreamPrinter({
    onIdlePrompt: () => {
      process.stdout.write(`\n${YOU_PREFIX} `);
    }
  });
  await startBaseStream(config, base, printer);
  process.stdout.write(`Interactive agent CLI. Base #${base.baseId}. Type /exit to quit.\n`);

  try {
    while (true) {
      const prompt = (await rl.question(`\n${YOU_PREFIX} `)).trim();
      if (!prompt) continue;
      if (prompt === "/exit" || prompt === "/quit") break;
      rl.pause();
      try {
        const wait = printer.beginTurn();
        await postChat(config, {
          baseDir: base.baseDir,
          system: base.systemPrompt,
          prompt
        });
        await wait;
      } finally {
        rl.resume();
      }
    }
  } finally {
    rl.close();
  }
};

export { runRepl, runSingle };
