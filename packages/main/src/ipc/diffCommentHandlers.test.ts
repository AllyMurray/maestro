import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { IPC_CHANNELS } from '@maestro/shared';
import { createTestDb } from '../__test-utils__/db';

let testDb: Database.Database;

vi.mock('../database/db', () => ({
  getDb: () => testDb,
}));

describe('diffCommentHandlers', () => {
  let handlers: Record<string, (...args: any[]) => any>;

  beforeEach(async () => {
    handlers = {};
    testDb = createTestDb();
    vi.clearAllMocks();

    testDb.prepare("INSERT INTO projects (id, name, path) VALUES ('p1','P','/tmp/repo')").run();
    testDb
      .prepare(
        "INSERT INTO workspaces (id, project_id, name, branch_name, status, agent_type) VALUES ('w1','p1','WS','feat/a','in_progress','claude-code')",
      )
      .run();

    const mockIpcMain = {
      handle: vi.fn((channel: string, handler: any) => {
        handlers[channel] = handler;
      }),
    };

    vi.resetModules();
    const { registerDiffCommentHandlers } = await import('./diffCommentHandlers');
    registerDiffCommentHandlers(mockIpcMain as any);
  });

  afterEach(() => {
    testDb.close();
  });

  it('creates, lists, and resolves diff comments', () => {
    const created = handlers[IPC_CHANNELS.DIFF_COMMENT_CREATE](null, {
      workspaceId: 'w1',
      filePath: 'src/a.ts',
      lineNumber: 42,
      body: 'nit',
    });
    expect(created.id).toBeTruthy();

    const listByFile = handlers[IPC_CHANNELS.DIFF_COMMENT_LIST](null, {
      workspaceId: 'w1',
      filePath: 'src/a.ts',
    });
    expect(listByFile).toHaveLength(1);
    expect(listByFile[0].lineNumber).toBe(42);

    const resolveResult = handlers[IPC_CHANNELS.DIFF_COMMENT_RESOLVE](null, Number(created.id));
    expect(resolveResult).toEqual({ success: true });

    const fullList = handlers[IPC_CHANNELS.DIFF_COMMENT_LIST](null, { workspaceId: 'w1' });
    expect(fullList[0].isResolved).toBe(1);
  });
});
