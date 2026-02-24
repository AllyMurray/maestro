import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IPC_CHANNELS } from '@maestro/shared';

const getSession = vi.fn();
const listSessions = vi.fn();
const getMessages = vi.fn();

vi.mock('../services/sessionManager', () => ({
  getSession: (...args: unknown[]) => getSession(...args),
  listSessions: (...args: unknown[]) => listSessions(...args),
  getMessages: (...args: unknown[]) => getMessages(...args),
}));

describe('sessionHandlers', () => {
  let handlers: Record<string, (...args: any[]) => any>;

  beforeEach(async () => {
    handlers = {};
    vi.clearAllMocks();

    const mockIpcMain = {
      handle: vi.fn((channel: string, handler: any) => {
        handlers[channel] = handler;
      }),
    };

    vi.resetModules();
    const { registerSessionHandlers } = await import('./sessionHandlers');
    registerSessionHandlers(mockIpcMain as any);
  });

  it('proxies session get/list handlers', () => {
    getSession.mockReturnValue({ id: 's1' });
    listSessions.mockReturnValue([{ id: 's1' }, { id: 's2' }]);

    expect(handlers[IPC_CHANNELS.SESSION_GET](null, 's1')).toEqual({ id: 's1' });
    expect(getSession).toHaveBeenCalledWith('s1');

    expect(handlers[IPC_CHANNELS.SESSION_LIST](null, 'w1')).toEqual([{ id: 's1' }, { id: 's2' }]);
    expect(listSessions).toHaveBeenCalledWith('w1');
  });

  it('passes pagination to message list handler', () => {
    getMessages.mockReturnValue([{ id: 1 }, { id: 2 }]);

    const result = handlers[IPC_CHANNELS.MESSAGE_LIST](null, 's1', 50, 100);
    expect(getMessages).toHaveBeenCalledWith('s1', 50, 100);
    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
  });
});
