import os from 'os';
import { logger } from './logger';

// node-pty must be required at runtime (native module)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pty = require('node-pty');

interface IPty {
  pid: number;
  cols: number;
  rows: number;
  onData: (callback: (data: string) => void) => { dispose: () => void };
  onExit: (callback: (e: { exitCode: number; signal?: number }) => void) => { dispose: () => void };
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: (signal?: string) => void;
}

interface TerminalSession {
  id: string;
  pty: IPty;
  workspacePath: string;
}

const terminals = new Map<string, TerminalSession>();

let idCounter = 0;

export function createTerminal(
  workspacePath: string,
  cols = 80,
  rows = 24,
  onData?: (data: string) => void,
  onExit?: (exitCode: number) => void,
): { id: string } {
  const id = `term-${++idCounter}`;
  const shell = process.env.SHELL || (os.platform() === 'win32' ? 'powershell.exe' : '/bin/zsh');

  const ptyProcess: IPty = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: workspacePath,
    env: {
      ...process.env,
      COLORTERM: 'truecolor',
    },
  });

  const session: TerminalSession = {
    id,
    pty: ptyProcess,
    workspacePath,
  };

  terminals.set(id, session);

  if (onData) {
    ptyProcess.onData(onData);
  }

  ptyProcess.onExit(({ exitCode }) => {
    terminals.delete(id);
    logger.info(`Terminal ${id} exited with code ${exitCode}`);
    if (onExit) {
      onExit(exitCode);
    }
  });

  logger.info(`Terminal ${id} created at ${workspacePath} (pid: ${ptyProcess.pid})`);
  return { id };
}

export function writeToTerminal(id: string, data: string): void {
  const session = terminals.get(id);
  if (session) {
    session.pty.write(data);
  }
}

export function resizeTerminal(id: string, cols: number, rows: number): void {
  const session = terminals.get(id);
  if (session) {
    session.pty.resize(cols, rows);
  }
}

export function closeTerminal(id: string): void {
  const session = terminals.get(id);
  if (session) {
    session.pty.kill();
    terminals.delete(id);
    logger.info(`Terminal ${id} killed`);
  }
}

export function getTerminal(id: string): TerminalSession | undefined {
  return terminals.get(id);
}

export function listTerminals(): Array<{ id: string; workspacePath: string }> {
  return Array.from(terminals.values()).map((t) => ({
    id: t.id,
    workspacePath: t.workspacePath,
  }));
}
