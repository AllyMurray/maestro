import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/checkpointManager', () => ({
  createCheckpoint: vi.fn().mockResolvedValue({ id: 1, commitHash: 'abc123' }),
  listCheckpoints: vi.fn().mockReturnValue([{ id: 1 }]),
  revertToCheckpoint: vi.fn().mockResolvedValue(undefined),
}));

describe('checkpointHandlers', () => {
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
    const { registerCheckpointHandlers } = await import('./checkpointHandlers');
    registerCheckpointHandlers(mockIpcMain as any);
  });

  it('registers checkpoint handlers', () => {
    expect(Object.keys(handlers)).toEqual(
      expect.arrayContaining(['checkpoint:create', 'checkpoint:list', 'checkpoint:revert']),
    );
  });

  it('creates checkpoint with expected args', async () => {
    const { createCheckpoint } = await import('../services/checkpointManager');

    const result = await handlers['checkpoint:create'](null, {
      workspacePath: '/tmp/ws',
      workspaceId: 'w1',
      sessionId: 's1',
      messageIndex: 42,
    });

    expect(createCheckpoint).toHaveBeenCalledWith('/tmp/ws', 'w1', 's1', 42);
    expect(result).toEqual({ id: 1, commitHash: 'abc123' });
  });

  it('lists checkpoints by workspace', async () => {
    const { listCheckpoints } = await import('../services/checkpointManager');
    const result = handlers['checkpoint:list'](null, 'w1');

    expect(listCheckpoints).toHaveBeenCalledWith('w1');
    expect(result).toEqual([{ id: 1 }]);
  });

  it('reverts checkpoint and returns success', async () => {
    const { revertToCheckpoint } = await import('../services/checkpointManager');
    const result = await handlers['checkpoint:revert'](null, {
      workspacePath: '/tmp/ws',
      checkpointId: 8,
    });

    expect(revertToCheckpoint).toHaveBeenCalledWith('/tmp/ws', 8);
    expect(result).toEqual({ success: true });
  });
});
