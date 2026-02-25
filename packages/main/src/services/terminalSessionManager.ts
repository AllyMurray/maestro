import os from 'os';
import path from 'path';
import fs from 'fs';
import { logger } from './logger';

type PtySpawnFn = (
  file: string,
  args: string[],
  opts: {
    name: string;
    cols: number;
    rows: number;
    cwd: string;
    env: NodeJS.ProcessEnv;
  },
) => IPty;

let ptySpawnOverride: PtySpawnFn | null = null;

function getPtySpawn(): PtySpawnFn {
  if (ptySpawnOverride) {
    return ptySpawnOverride;
  }
  // node-pty must be required at runtime (native module)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const runtimePty = require('node-pty');
  return runtimePty.spawn;
}

let spawnHelperFixed = false;

function ensureSpawnHelper(): void {
  if (spawnHelperFixed) return;
  try {
    const ptyDir = path.dirname(path.dirname(require.resolve('node-pty')));
    const prebuildsDir = path.join(ptyDir, 'prebuilds');
    logger.info(
      `ensureSpawnHelper: ptyDir=${ptyDir}, prebuildsExists=${fs.existsSync(prebuildsDir)}`,
    );
    if (fs.existsSync(prebuildsDir)) {
      const platforms = fs.readdirSync(prebuildsDir);
      for (const platform of platforms) {
        const helper = path.join(prebuildsDir, platform, 'spawn-helper');
        if (fs.existsSync(helper)) {
          fs.chmodSync(helper, 0o755);
          logger.info(`Fixed permissions on ${helper}`);
        }
      }
    }
  } catch (err) {
    logger.warn(`Could not fix spawn-helper permissions: ${err}`);
  }
  spawnHelperFixed = true;
}

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

export function resetTerminalSessionStateForTests(): void {
  terminals.clear();
  idCounter = 0;
  spawnHelperFixed = false;
  ptySpawnOverride = null;
}

export function setSpawnHelperFixedForTests(value: boolean): void {
  spawnHelperFixed = value;
}

export function setPtySpawnOverrideForTests(override: PtySpawnFn | null): void {
  ptySpawnOverride = override;
}

export function createTerminal(
  workspacePath: string,
  cols = 80,
  rows = 24,
  onData?: (data: string) => void,
  onExit?: (exitCode: number) => void,
): { id: string } {
  ensureSpawnHelper();

  const id = `term-${++idCounter}`;
  const shell = process.env.SHELL || (os.platform() === 'win32' ? 'powershell.exe' : '/bin/zsh');

  const ptyProcess: IPty = getPtySpawn()(shell, [], {
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
