import { spawn } from 'node:child_process';
import process from 'node:process';

const getShellCommand = () => {
  if (process.platform === 'win32') {
    return {
      command: process.env.ComSpec || 'cmd.exe',
      args: ['/d', '/s', '/c'],
    };
  }

  return {
    command: process.env.SHELL || '/bin/bash',
    args: ['-lc'],
  };
};

export const createLocalShellBackend = () => ({
  spawn(command, { cwd, env, input, useShell = true } = {}) {
    const mergedEnv = {
      ...process.env,
      ...(env || {}),
    };

    if (!useShell) {
      const child = spawn(command, [], {
        cwd,
        env: mergedEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      if (input != null) {
        child.stdin.write(String(input));
      }
      child.stdin.end();
      return child;
    }

    const shell = getShellCommand();
    const child = spawn(shell.command, [...shell.args, String(command || '')], {
      cwd,
      env: mergedEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (input != null) {
      child.stdin.write(String(input));
    }
    child.stdin.end();
    return child;
  },
});
