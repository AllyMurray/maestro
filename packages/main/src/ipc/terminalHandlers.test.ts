import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IPC_CHANNELS } from '@maestro/shared';

const createTerminal = vi.fn();
const writeToTerminal = vi.fn();
const resizeTerminal = vi.fn();
const closeTerminal = vi.fn();
const send = vi.fn();

vi.mock('../services/terminalSessionManager', () => ({
  createTerminal: (...args: unknown[]) => createTerminal(...args),
  writeToTerminal: (...args: unknown[]) => writeToTerminal(...args),
  resizeTerminal: (...args: unknown[]) => resizeTerminal(...args),
  closeTerminal: (...args: unknown[]) => closeTerminal(...args),
}));

vi.mock('electron', async (orig) => {
  const actual = await orig<typeof import('electron')>();
  return {
    ...actual,
    BrowserWindow: {
      fromWebContents: vi.fn(() => ({ webContents: { send } })),
    },
  };
});

describe('terminalHandlers', () => {
  let handleMap: Record<string, (...args: any[]) => any>;
  let onMap: Record<string, (...args: any[]) => any>;

  beforeEach(async () => {
    handleMap = {};
    onMap = {};
    vi.clearAllMocks();

    createTerminal.mockImplementation(() => ({ id: 'term-1' }));

    const mockIpcMain = {
      handle: vi.fn((channel: string, handler: any) => {
        handleMap[channel] = handler;
      }),
      on: vi.fn((channel: string, handler: any) => {
        onMap[channel] = handler;
      }),
    };

    vi.resetModules();
    const { registerTerminalHandlers } = await import('./terminalHandlers');
    registerTerminalHandlers(mockIpcMain as any);
  });

  it('creates terminal and returns terminal id', () => {
    const event = { sender: { id: 1 } } as any;
    const result = handleMap[IPC_CHANNELS.TERMINAL_CREATE](event, {
      workspacePath: '/tmp/ws',
      cols: 100,
      rows: 40,
    });

    expect(createTerminal).toHaveBeenCalled();
    expect(result).toEqual({ id: 'term-1' });
    expect(send).not.toHaveBeenCalled();
  });

  it('writes, resizes and closes terminal sessions', () => {
    onMap[IPC_CHANNELS.TERMINAL_WRITE](null, { terminalId: 'term-1', data: 'ls\n' });
    expect(writeToTerminal).toHaveBeenCalledWith('term-1', 'ls\n');

    onMap[IPC_CHANNELS.TERMINAL_RESIZE](null, { terminalId: 'term-1', cols: 120, rows: 50 });
    expect(resizeTerminal).toHaveBeenCalledWith('term-1', 120, 50);

    const result = handleMap[IPC_CHANNELS.TERMINAL_CLOSE](null, 'term-1');
    expect(closeTerminal).toHaveBeenCalledWith('term-1');
    expect(result).toEqual({ success: true });
  });
});
