import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IPC_CHANNELS } from '@maestro/shared';

const getConfig = vi.fn();
const setConfig = vi.fn();
const getAllConfig = vi.fn();

vi.mock('../services/configManager', () => ({
  getConfig: (...args: unknown[]) => getConfig(...args),
  setConfig: (...args: unknown[]) => setConfig(...args),
  getAllConfig: () => getAllConfig(),
}));

describe('configHandlers', () => {
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
    const { registerConfigHandlers } = await import('./configHandlers');
    registerConfigHandlers(mockIpcMain as any);
  });

  it('gets and sets config values through service', () => {
    getConfig.mockReturnValue('abc');

    const value = handlers[IPC_CHANNELS.CONFIG_GET](null, 'openai.apiKey');
    expect(value).toBe('abc');
    expect(getConfig).toHaveBeenCalledWith('openai.apiKey');

    const result = handlers[IPC_CHANNELS.CONFIG_SET](null, 'openai.apiKey', 'secret');
    expect(setConfig).toHaveBeenCalledWith('openai.apiKey', 'secret');
    expect(result).toEqual({ success: true });
  });

  it('returns all config values', () => {
    getAllConfig.mockReturnValue({ a: '1', b: '2' });

    const result = handlers[IPC_CHANNELS.CONFIG_GET_ALL](null);
    expect(result).toEqual({ a: '1', b: '2' });
  });
});
