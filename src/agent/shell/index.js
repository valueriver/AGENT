import process from 'node:process';
import { createLocalShellBackend } from './backend.js';
import {
  appendSessionStderr,
  appendSessionStdout,
  closeSessionRecord,
  createSessionRecord,
  getSessionRecord,
  listSessionRecords,
  readSessionCombined,
  readSessionStderr,
  readSessionStdout,
} from './sessions.js';
import { DEFAULT_MAX_OUTPUT_CHARS, truncateOutput } from './truncate.js';

const DEFAULT_TIMEOUT_SECONDS = 30;
const MAX_TIMEOUT_SECONDS = 3600;

const backend = createLocalShellBackend();

const now = () => Date.now();

const normalizeTimeoutSeconds = (value, fallback = DEFAULT_TIMEOUT_SECONDS) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.min(MAX_TIMEOUT_SECONDS, Math.floor(num));
};

const normalizeCwd = (cwd) => {
  if (cwd == null || cwd === '') return process.cwd();
  return String(cwd);
};

const normalizeChunk = (chunk) => String(chunk ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

const buildOutputPayload = ({ stdout, stderr, combined, maxOutputChars }) => {
  const output = truncateOutput(combined, maxOutputChars);
  const stdoutResult = truncateOutput(stdout, maxOutputChars);
  const stderrResult = truncateOutput(stderr, maxOutputChars);
  return {
    stdout: stdoutResult.content,
    stderr: stderrResult.content,
    output: output.content,
    truncated: output.truncated || stdoutResult.truncated || stderrResult.truncated,
  };
};

const serializeSession = (record, { maxOutputChars = DEFAULT_MAX_OUTPUT_CHARS } = {}) => {
  const stdout = readSessionStdout(record);
  const stderr = readSessionStderr(record);
  const combined = readSessionCombined(record);
  const payload = buildOutputPayload({ stdout, stderr, combined, maxOutputChars });

  return {
    sessionId: record.id,
    command: record.command,
    cwd: record.cwd,
    running: record.endedAt == null,
    exitCode: record.exitCode,
    signal: record.signal,
    timedOut: record.timedOut,
    ptyRequested: record.ptyRequested,
    ptySupported: false,
    durationMs: (record.endedAt || now()) - record.startedAt,
    ...payload,
  };
};

const attachSessionLifecycle = (record) => {
  record.child.stdout?.on('data', (chunk) => {
    appendSessionStdout(record, normalizeChunk(chunk));
  });

  record.child.stderr?.on('data', (chunk) => {
    appendSessionStderr(record, normalizeChunk(chunk));
  });

  record.child.on('exit', (code, signal) => {
    record.exitCode = typeof code === 'number' ? code : null;
    record.signal = signal || null;
    record.endedAt = now();
    if (record.timer) {
      clearTimeout(record.timer);
      record.timer = null;
    }
  });
};

const spawnSession = ({
  command,
  cwd,
  env,
  input,
  timeoutSeconds,
  pty = false,
  useShell = true,
}) => {
  const child = backend.spawn(command, { cwd, env, input, useShell });
  const record = createSessionRecord({
    child,
    command,
    cwd,
    timeoutSeconds,
    ptyRequested: pty,
  });

  attachSessionLifecycle(record);

  if (timeoutSeconds > 0) {
    record.timer = setTimeout(() => {
      record.timedOut = true;
      record.child.kill('SIGTERM');
    }, timeoutSeconds * 1000);
  }

  return record;
};

export const shellExec = async ({
  command,
  cwd,
  timeoutSeconds = DEFAULT_TIMEOUT_SECONDS,
  env,
  input,
  maxOutputChars = DEFAULT_MAX_OUTPUT_CHARS,
  pty = false,
  useShell = true,
} = {}) => {
  if (!command) {
    throw new Error('command is required');
  }

  const effectiveTimeoutSeconds = normalizeTimeoutSeconds(timeoutSeconds);
  const effectiveCwd = normalizeCwd(cwd);
  const record = spawnSession({
    command: String(command),
    cwd: effectiveCwd,
    env,
    input,
    timeoutSeconds: effectiveTimeoutSeconds,
    pty,
    useShell,
  });

  await new Promise((resolve, reject) => {
    record.child.on('error', reject);
    record.child.on('close', resolve);
  });

  const result = serializeSession(record, { maxOutputChars });
  closeSessionRecord(record.id);

  return {
    ok: !result.timedOut && (result.exitCode === 0 || result.exitCode === null),
    ...result,
  };
};

export const shellStart = async ({
  command,
  cwd,
  timeoutSeconds = 0,
  env,
  input,
  pty = false,
  useShell = true,
} = {}) => {
  if (!command) {
    throw new Error('command is required');
  }

  const record = spawnSession({
    command: String(command),
    cwd: normalizeCwd(cwd),
    env,
    input,
    timeoutSeconds: normalizeTimeoutSeconds(timeoutSeconds, 0),
    pty,
    useShell,
  });

  return {
    ok: true,
    sessionId: record.id,
    command: record.command,
    cwd: record.cwd,
    running: true,
    ptyRequested: record.ptyRequested,
    ptySupported: false,
    note: pty ? 'pty requested but not implemented in this version' : undefined,
  };
};

export const shellPoll = async ({
  sessionId,
  maxOutputChars = DEFAULT_MAX_OUTPUT_CHARS,
  close = false,
} = {}) => {
  const record = getSessionRecord(sessionId);
  if (!record) {
    throw new Error(`unknown session: ${sessionId}`);
  }

  const result = serializeSession(record, { maxOutputChars });
  if (close && !result.running) {
    closeSessionRecord(record.id);
  }

  return result;
};

export const shellWrite = async ({
  sessionId,
  input = '',
  maxOutputChars = DEFAULT_MAX_OUTPUT_CHARS,
  closeStdin = false,
} = {}) => {
  const record = getSessionRecord(sessionId);
  if (!record) {
    throw new Error(`unknown session: ${sessionId}`);
  }
  if (record.endedAt != null) {
    return serializeSession(record, { maxOutputChars });
  }

  if (input) {
    record.child.stdin?.write(String(input));
  }
  if (closeStdin) {
    record.child.stdin?.end();
  }

  return serializeSession(record, { maxOutputChars });
};

export const shellKill = async ({
  sessionId,
  signal = 'SIGTERM',
  maxOutputChars = DEFAULT_MAX_OUTPUT_CHARS,
} = {}) => {
  const record = getSessionRecord(sessionId);
  if (!record) {
    throw new Error(`unknown session: ${sessionId}`);
  }

  if (record.endedAt == null) {
    record.child.kill(signal);
  }

  return serializeSession(record, { maxOutputChars });
};

export const shellListSessions = async ({
  maxOutputChars = 2000,
} = {}) => {
  const sessions = listSessionRecords().map((record) => serializeSession(record, { maxOutputChars }));
  return {
    count: sessions.length,
    sessions,
  };
};
