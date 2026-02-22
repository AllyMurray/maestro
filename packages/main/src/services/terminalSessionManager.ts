import { spawn, ChildProcess } from 'child_process';
import os from 'os';
import { logger } from './logger';

interface TerminalSession {
  id: string;
  process: ChildProcess;
  workspacePath: string;
  cols: number;
  rows: number;
}

const terminals = new Map<string, TerminalSession>();

let idCounter = 0;

export function createTerminal(
  workspacePath: string,
  cols = 80,
  rows = 24,
): { id: string } {
  const id = `term-${++idCounter}`;
  const shell = process.env.SHELL || '/bin/zsh';

  const proc = spawn(shell, ['-l'], {
    cwd: workspacePath,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const session: TerminalSession = {
    id,
    process: proc,
    workspacePath,
    cols,
    rows,
  };

  terminals.set(id, session);

  proc.on('close', () => {
    terminals.delete(id);
    logger.info(`Terminal ${id} closed`);
  });

  proc.on('error', (err) => {
    logger.error(`Terminal ${id} error:`, err.message);
    terminals.delete(id);
  });

  logger.info(`Terminal ${id} created at ${workspacePath}`);
  return { id };
}

export function writeToTerminal(id: string, data: string): void {
  const session = terminals.get(id);
  if (session?.process.stdin) {
    session.process.stdin.write(data);
  }
}

export function resizeTerminal(id: string, cols: number, rows: number): void {
  const session = terminals.get(id);
  if (session) {
    session.cols = cols;
    session.rows = rows;
    // Note: resize via signals not supported with plain spawn
    // In production, use node-pty for proper resize
  }
}

export function closeTerminal(id: string): void {
  const session = terminals.get(id);
  if (session) {
    session.process.kill();
    terminals.delete(id);
    logger.info(`Terminal ${id} killed`);
  }
}

export function getTerminal(id: string): TerminalSession | undefined {
  return terminals.get(id);
}

export function getTerminalProcess(id: string): ChildProcess | undefined {
  return terminals.get(id)?.process;
}

export function listTerminals(): Array<{ id: string; workspacePath: string }> {
  return Array.from(terminals.values()).map((t) => ({
    id: t.id,
    workspacePath: t.workspacePath,
  }));
}
