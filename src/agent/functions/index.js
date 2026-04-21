import {
  terminalExec,
  terminalKill,
  terminalList,
  terminalRead,
  terminalStart,
  terminalWrite,
} from "./terminal/index.js";

const terminal_exec = async ({
  command,
  cwd,
  timeoutSeconds,
  env,
  input,
  maxOutputChars,
} = {}, options = {}) =>
  terminalExec({
    command,
    cwd,
    timeoutSeconds,
    env,
    input,
    maxOutputChars,
    signal: options.signal,
  });

const terminal_start = async ({
  command,
  cwd,
  timeoutSeconds,
  env,
  input,
} = {}) =>
  terminalStart({
    command,
    cwd,
    timeoutSeconds,
    env,
    input,
  });

const terminal_read = async ({ sessionId, maxOutputChars } = {}) =>
  terminalRead({
    sessionId,
    maxOutputChars,
  });

const terminal_write = async ({
  sessionId,
  input,
  maxOutputChars,
  closeStdin = false,
} = {}) =>
  terminalWrite({
    sessionId,
    input,
    maxOutputChars,
    closeStdin,
  });

const terminal_kill = async ({
  sessionId,
  signal,
  maxOutputChars,
} = {}) =>
  terminalKill({
    sessionId,
    signal,
    maxOutputChars,
  });

const terminal_list = async ({ maxOutputChars } = {}) =>
  terminalList({
    maxOutputChars,
  });

export {
  terminal_exec,
  terminal_kill,
  terminal_list,
  terminal_read,
  terminal_start,
  terminal_write,
};
