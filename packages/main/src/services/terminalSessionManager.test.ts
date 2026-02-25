import { beforeEach, describe, expect, it, vi } from 'vitest';

const spawnMock = vi.fn();
const infoMock = vi.fn();
const warnMock = vi.fn();

vi.mock('./logger', () => ({
  logger: {
    info: (...args: unknown[]) => infoMock(...args),
    warn: (...args: unknown[]) => warnMock(...args),
  },
}));

describe('terminalSessionManager', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    spawnMock.mockReset();
    const mod = await import('./terminalSessionManager');
    mod.resetTerminalSessionStateForTests();
    mod.setSpawnHelperFixedForTests(true);
    mod.setPtySpawnOverrideForTests(spawnMock as any);
  });

  it('creates a terminal and tracks session metadata', async () => {
    const onData = vi.fn();
    const onExit = vi.fn();
    const onExitRegister = vi.fn();
    const ptyProcess = {
      pid: 123,
      cols: 80,
      rows: 24,
      onData: vi.fn(),
      onExit: onExitRegister,
      write: vi.fn(),
      resize: vi.fn(),
      kill: vi.fn(),
    };
    spawnMock.mockReturnValue(ptyProcess);

    const mod = await import('./terminalSessionManager');
    const created = mod.createTerminal('/tmp/ws', 120, 40, onData, onExit);

    expect(created.id).toBe('term-1');
    expect(spawnMock).toHaveBeenCalledWith(
      expect.any(String),
      [],
      expect.objectContaining({ cwd: '/tmp/ws', cols: 120, rows: 40 }),
    );
    expect(ptyProcess.onData).toHaveBeenCalledWith(onData);
    expect(mod.getTerminal(created.id)?.workspacePath).toBe('/tmp/ws');
    expect(mod.listTerminals()).toEqual([{ id: 'term-1', workspacePath: '/tmp/ws' }]);
    expect(onExitRegister).toHaveBeenCalledWith(expect.any(Function));
  });

  it('writes, resizes, and closes terminal sessions', async () => {
    let exitHandler: ((e: { exitCode: number; signal?: number }) => void) | undefined;
    const ptyProcess = {
      pid: 456,
      cols: 80,
      rows: 24,
      onData: vi.fn(),
      onExit: vi.fn((cb: (e: { exitCode: number; signal?: number }) => void) => {
        exitHandler = cb;
      }),
      write: vi.fn(),
      resize: vi.fn(),
      kill: vi.fn(),
    };
    spawnMock.mockReturnValue(ptyProcess);

    const mod = await import('./terminalSessionManager');
    const onExit = vi.fn();
    const created = mod.createTerminal('/tmp/ws', 80, 24, undefined, onExit);

    mod.writeToTerminal(created.id, 'ls\n');
    expect(ptyProcess.write).toHaveBeenCalledWith('ls\n');

    mod.resizeTerminal(created.id, 100, 30);
    expect(ptyProcess.resize).toHaveBeenCalledWith(100, 30);

    exitHandler?.({ exitCode: 0 });
    expect(onExit).toHaveBeenCalledWith(0);
    expect(mod.getTerminal(created.id)).toBeUndefined();

    const created2 = mod.createTerminal('/tmp/ws');
    mod.closeTerminal(created2.id);
    expect(ptyProcess.kill).toHaveBeenCalled();
    expect(mod.getTerminal(created2.id)).toBeUndefined();
  });
});
