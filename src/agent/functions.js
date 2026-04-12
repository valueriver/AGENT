import {
  shellExec,
  shellKill,
  shellListSessions,
  shellPoll,
  shellStart,
  shellWrite,
} from "./pty/index.js";

const pty_exec = async ({
  command,
  cwd,
  timeoutSeconds,
  env,
  input,
  maxOutputChars,
} = {}) =>
  shellExec({
    command,
    cwd,
    timeoutSeconds,
    env,
    input,
    maxOutputChars,
  });

const pty_start = async ({
  command,
  cwd,
  timeoutSeconds,
  env,
  input,
} = {}) =>
  shellStart({
    command,
    cwd,
    timeoutSeconds,
    env,
    input,
  });

const pty_read = async ({ sessionId, maxOutputChars } = {}) =>
  shellPoll({
    sessionId,
    maxOutputChars,
  });

const pty_write = async ({
  sessionId,
  input,
  maxOutputChars,
  closeStdin = false,
} = {}) =>
  shellWrite({
    sessionId,
    input,
    maxOutputChars,
    closeStdin,
  });

const pty_kill = async ({
  sessionId,
  signal,
  maxOutputChars,
} = {}) =>
  shellKill({
    sessionId,
    signal,
    maxOutputChars,
  });

const pty_list = async ({ maxOutputChars } = {}) =>
  shellListSessions({
    maxOutputChars,
  });

export {
  pty_exec,
  pty_kill,
  pty_list,
  pty_read,
  pty_start,
  pty_write,
};
