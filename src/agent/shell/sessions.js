import { randomUUID } from 'node:crypto';

const sessions = new Map();

const now = () => Date.now();

const createBufferState = () => ({
  chunks: [],
  totalChars: 0,
});

const appendBuffer = (state, chunk) => {
  if (!chunk) return;
  state.chunks.push(chunk);
  state.totalChars += chunk.length;
};

const readBuffer = (state) => state.chunks.join('');

export const createSessionRecord = ({ child, command, cwd, timeoutSeconds, ptyRequested }) => {
  const id = randomUUID();
  const record = {
    id,
    child,
    command,
    cwd,
    timeoutSeconds,
    ptyRequested: !!ptyRequested,
    startedAt: now(),
    endedAt: null,
    exitCode: null,
    signal: null,
    timedOut: false,
    stdout: createBufferState(),
    stderr: createBufferState(),
    combined: createBufferState(),
    timer: null,
  };

  sessions.set(id, record);
  return record;
};

export const getSessionRecord = (id) => sessions.get(String(id || '')) || null;

export const closeSessionRecord = (id) => {
  const record = getSessionRecord(id);
  if (!record) return false;
  if (record.timer) clearTimeout(record.timer);
  sessions.delete(record.id);
  return true;
};

export const listSessionRecords = () => Array.from(sessions.values());

export const appendSessionStdout = (record, chunk) => {
  appendBuffer(record.stdout, chunk);
  appendBuffer(record.combined, chunk);
};

export const appendSessionStderr = (record, chunk) => {
  appendBuffer(record.stderr, chunk);
  appendBuffer(record.combined, chunk);
};

export const readSessionStdout = (record) => readBuffer(record.stdout);
export const readSessionStderr = (record) => readBuffer(record.stderr);
export const readSessionCombined = (record) => readBuffer(record.combined);
