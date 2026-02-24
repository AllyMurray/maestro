import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IPC_CHANNELS } from '@maestro/shared';

const getGitStatus = vi.fn();
const getDiff = vi.fn();
const getDiffFiles = vi.fn();

vi.mock('../services/gitStatusManager', () => ({
  getGitStatus: (...args: unknown[]) => getGitStatus(...args),
  getDiff: (...args: unknown[]) => getDiff(...args),
  getDiffFiles: (...args: unknown[]) => getDiffFiles(...args),
}));

describe('gitHandlers', () => {
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
    const { registerGitHandlers } = await import('./gitHandlers');
    registerGitHandlers(mockIpcMain as any);
  });

  it('proxies git status/diff APIs', async () => {
    getGitStatus.mockResolvedValue({ branch: 'main' });
    getDiff.mockResolvedValue('diff --git a');
    getDiffFiles.mockResolvedValue([{ path: 'a.ts' }]);

    await expect(handlers[IPC_CHANNELS.GIT_STATUS](null, '/tmp/ws')).resolves.toEqual({
      branch: 'main',
    });
    expect(getGitStatus).toHaveBeenCalledWith('/tmp/ws');

    await expect(
      handlers[IPC_CHANNELS.GIT_DIFF](null, {
        workspacePath: '/tmp/ws',
        filePath: 'src/a.ts',
        staged: true,
      }),
    ).resolves.toBe('diff --git a');
    expect(getDiff).toHaveBeenCalledWith('/tmp/ws', 'src/a.ts', true);

    await expect(
      handlers[IPC_CHANNELS.GIT_DIFF_FILES](null, {
        workspacePath: '/tmp/ws',
        base: 'origin/main',
      }),
    ).resolves.toEqual([{ path: 'a.ts' }]);
    expect(getDiffFiles).toHaveBeenCalledWith('/tmp/ws', 'origin/main');
  });
});
