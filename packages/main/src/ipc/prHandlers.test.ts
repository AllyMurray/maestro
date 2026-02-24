import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { IPC_CHANNELS } from '@maestro/shared';
import { createTestDb } from '../__test-utils__/db';

let testDb: Database.Database;

const platformApi = {
  createPR: vi.fn(),
  getPR: vi.fn(),
  mergePR: vi.fn(),
  listComments: vi.fn(),
  getChecks: vi.fn(),
};

vi.mock('../database/db', () => ({
  getDb: () => testDb,
}));

vi.mock('../services/git-platforms', () => ({
  createGitPlatform: vi.fn(() => platformApi),
}));

vi.mock('../services/logger', () => ({
  logger: {
    info: vi.fn(),
  },
}));

describe('prHandlers', () => {
  let handlers: Record<string, (...args: any[]) => any>;

  beforeEach(async () => {
    testDb = createTestDb();
    handlers = {};
    vi.clearAllMocks();

    testDb
      .prepare("INSERT INTO projects (id, name, path) VALUES ('p1', 'Project', '/tmp/repo')")
      .run();
    testDb
      .prepare(
        "INSERT INTO workspaces (id, project_id, name, branch_name, status, agent_type) VALUES ('w1','p1','WS','feat/pr','in_progress','claude-code')",
      )
      .run();

    platformApi.createPR.mockResolvedValue({ number: 101, url: 'https://example/pr/101' });
    platformApi.getPR.mockResolvedValue({ id: '101' });
    platformApi.mergePR.mockResolvedValue(undefined);
    platformApi.listComments.mockResolvedValue([{ id: 'c1' }]);
    platformApi.getChecks.mockResolvedValue([{ name: 'ci', status: 'success' }]);

    const mockIpcMain = {
      handle: vi.fn((channel: string, handler: any) => {
        handlers[channel] = handler;
      }),
    };

    vi.resetModules();
    const { registerPRHandlers } = await import('./prHandlers');
    registerPRHandlers(mockIpcMain as any);
  });

  afterEach(() => {
    testDb.close();
  });

  it('creates PR and updates workspace metadata', async () => {
    const result = await handlers[IPC_CHANNELS.PR_CREATE](null, {
      workspaceId: 'w1',
      repoPath: '/tmp/repo',
      platform: 'github',
      opts: { title: 'PR title', body: 'body', head: 'feat/pr', base: 'main' },
    });

    expect(platformApi.createPR).toHaveBeenCalled();
    expect(result).toEqual({ number: 101, url: 'https://example/pr/101' });
    const row = testDb
      .prepare("SELECT pr_number, pr_url FROM workspaces WHERE id = 'w1'")
      .get() as { pr_number: string; pr_url: string };
    expect(Number(row.pr_number)).toBe(101);
    expect(row.pr_url).toBe('https://example/pr/101');
  });

  it('proxies PR get/merge/comments/checks handlers', async () => {
    await expect(
      handlers[IPC_CHANNELS.PR_GET](null, {
        repoPath: '/tmp/repo',
        platform: 'github',
        prId: '101',
      }),
    ).resolves.toEqual({ id: '101' });

    await expect(
      handlers[IPC_CHANNELS.PR_MERGE](null, {
        repoPath: '/tmp/repo',
        platform: 'github',
        prId: '101',
        strategy: 'squash',
      }),
    ).resolves.toEqual({ success: true });

    await expect(
      handlers[IPC_CHANNELS.PR_LIST_COMMENTS](null, {
        repoPath: '/tmp/repo',
        platform: 'github',
        prId: '101',
      }),
    ).resolves.toEqual([{ id: 'c1' }]);

    await expect(
      handlers[IPC_CHANNELS.PR_GET_CHECKS](null, {
        repoPath: '/tmp/repo',
        platform: 'github',
        ref: 'refs/pull/101/head',
      }),
    ).resolves.toEqual([{ name: 'ci', status: 'success' }]);
  });
});
