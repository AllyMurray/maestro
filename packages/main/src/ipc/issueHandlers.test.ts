import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { IPC_CHANNELS } from '@maestro/shared';
import { createTestDb } from '../__test-utils__/db';

let testDb: Database.Database;

const searchIssues = vi.fn();

vi.mock('../database/db', () => ({
  getDb: () => testDb,
}));

vi.mock('../services/git-platforms', () => ({
  createGitPlatform: vi.fn(() => ({ searchIssues })),
}));

describe('issueHandlers', () => {
  let handlers: Record<string, (...args: any[]) => any>;

  beforeEach(async () => {
    testDb = createTestDb();
    handlers = {};
    vi.clearAllMocks();
    searchIssues.mockResolvedValue([{ id: '42', title: 'Fix bug' }]);

    testDb
      .prepare("INSERT INTO projects (id, name, path) VALUES ('p1', 'Project', '/tmp/repo')")
      .run();
    testDb
      .prepare(
        "INSERT INTO workspaces (id, project_id, name, branch_name, status, agent_type) VALUES ('w1','p1','WS','feat/issues','in_progress','claude-code')",
      )
      .run();

    const mockIpcMain = {
      handle: vi.fn((channel: string, handler: any) => {
        handlers[channel] = handler;
      }),
    };

    vi.resetModules();
    const { registerIssueHandlers } = await import('./issueHandlers');
    registerIssueHandlers(mockIpcMain as any);
  });

  afterEach(() => {
    testDb.close();
  });

  it('searches issues through git platform service', async () => {
    const result = await handlers[IPC_CHANNELS.ISSUE_SEARCH](null, {
      repoPath: '/tmp/repo',
      platform: 'github',
      query: 'fix',
    });

    expect(searchIssues).toHaveBeenCalledWith('/tmp/repo', 'fix');
    expect(result).toEqual([{ id: '42', title: 'Fix bug' }]);
  });

  it('links and unlinks issues for workspace', () => {
    const linkResult = handlers[IPC_CHANNELS.ISSUE_LINK](null, {
      workspaceId: 'w1',
      source: 'github',
      issueId: '42',
      title: 'Fix bug',
      url: 'https://example/issues/42',
    });

    expect(linkResult).toEqual({ success: true });
    const linked = testDb.prepare('SELECT * FROM linked_issues').all() as Array<{ id: number }>;
    expect(linked).toHaveLength(1);

    const unlinkResult = handlers[IPC_CHANNELS.ISSUE_UNLINK](null, linked[0].id);
    expect(unlinkResult).toEqual({ success: true });
    expect(testDb.prepare('SELECT * FROM linked_issues').all()).toHaveLength(0);
  });
});
