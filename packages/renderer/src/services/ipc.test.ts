import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ipc } from './ipc';

describe('ipc service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('invoke delegates to window.maestro.invoke', async () => {
    (window.maestro.invoke as any).mockResolvedValue('test-result');

    const result = await ipc.invoke('test-channel', 'arg1', 'arg2');
    expect(window.maestro.invoke).toHaveBeenCalledWith('test-channel', 'arg1', 'arg2');
    expect(result).toBe('test-result');
  });

  it('on delegates to window.maestro.on', () => {
    const callback = vi.fn();
    const unsub = vi.fn();
    (window.maestro.on as any).mockReturnValue(unsub);

    const result = ipc.on('test-channel', callback);
    expect(window.maestro.on).toHaveBeenCalledWith('test-channel', callback);
    expect(result).toBe(unsub);
  });

  it('send delegates to window.maestro.send', () => {
    ipc.send('test-channel', 'arg1');
    expect(window.maestro.send).toHaveBeenCalledWith('test-channel', 'arg1');
  });

  it('invoke returns typed result', async () => {
    (window.maestro.invoke as any).mockResolvedValue({ id: '1', name: 'test' });

    const result = await ipc.invoke<{ id: string; name: string }>('get-item');
    expect(result.id).toBe('1');
    expect(result.name).toBe('test');
  });
});
