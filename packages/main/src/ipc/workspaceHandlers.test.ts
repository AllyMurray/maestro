import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { IPC_CHANNELS } from '@maestro/shared';
import { createTestDb } from '../__test-utils__/db';

let testDb: Database.Database;

const createWorktree = vi.fn();
const removeWorktree = vi.fn();
const getWorktreePath = vi.fn();

vi.mock('../database/db', () => ({
  getDb: () => testDb,
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'ws-fixed-id'),
}));

vi.mock('../services/worktreeManager', () => ({
  createWorktree: (...args: unknown[]) => createWorktree(...args),
  removeWorktree: (...args: unknown[]) => removeWorktree(...args),
  getWorktreePath: (...args: unknown[]) => getWorktreePath(...args),
}));

vi.mock('../services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('workspaceHandlers', () => {
  let handlers: Record<string, (...args: any[]) => any>;

  beforeEach(async () => {
    testDb = createTestDb();
    handlers = {};
    vi.clearAllMocks();

    testDb
      .prepare("INSERT INTO projects (id, name, path) VALUES ('p1', 'Project', '/tmp/repo')")
      .run();
    getWorktreePath.mockReturnValue('/tmp/repo/.worktrees/feat-a');
    createWorktree.mockResolvedValue(undefined);
    removeWorktree.mockResolvedValue(undefined);

    const mockIpcMain = {
      handle: vi.fn((channel: string, handler: any) => {
        handlers[channel] = handler;
      }),
    };

    vi.resetModules();
    const { registerWorkspaceHandlers } = await import('./workspaceHandlers');
    registerWorkspaceHandlers(mockIpcMain as any);
  });

  afterEach(() => {
    testDb.close();
  });

  it('creates workspace and worktree', async () => {
    const workspace = await handlers[IPC_CHANNELS.WORKSPACE_CREATE](null, {
      projectId: 'p1',
      name: 'WS A',
      branchName: 'feat-a',
      agentType: 'claude-code',
    });

    expect(createWorktree).toHaveBeenCalledWith(
      '/tmp/repo',
      'feat-a',
      '/tmp/repo/.worktrees/feat-a',
    );
    expect(workspace.id).toBe('ws-fixed-id');
    expect(workspace.targetBranch).toBe('main');
    expect(workspace.status).toBe('in_progress');
    expect(workspace.agentType).toBe('claude-code');
  });

  it('deletes workspace and attempts worktree cleanup', async () => {
    testDb
      .prepare(
        "INSERT INTO workspaces (id, project_id, name, branch_name, worktree_path, status, agent_type) VALUES ('w1','p1','WS','feat/a','/tmp/repo/.worktrees/feat-a','in_progress','codex')",
      )
      .run();

    const result = await handlers[IPC_CHANNELS.WORKSPACE_DELETE](null, 'w1');
    expect(removeWorktree).toHaveBeenCalledWith('/tmp/repo', '/tmp/repo/.worktrees/feat-a');
    expect(result).toEqual({ success: true });
    expect(testDb.prepare("SELECT * FROM workspaces WHERE id = 'w1'").get()).toBeUndefined();
  });

  it('returns warning-safe success when worktree removal fails', async () => {
    testDb
      .prepare(
        "INSERT INTO workspaces (id, project_id, name, branch_name, worktree_path, status, agent_type) VALUES ('w2','p1','WS2','feat/b','/tmp/repo/.worktrees/feat-b','in_progress','cursor')",
      )
      .run();
    removeWorktree.mockRejectedValueOnce(new Error('rm failed'));

    const result = await handlers[IPC_CHANNELS.WORKSPACE_DELETE](null, 'w2');
    expect(result).toEqual({ success: true });
    expect(testDb.prepare("SELECT * FROM workspaces WHERE id = 'w2'").get()).toBeUndefined();
  });

  it('rejects invalid workspace status', () => {
    expect(() =>
      handlers[IPC_CHANNELS.WORKSPACE_UPDATE_STATUS](null, {
        id: 'w-missing',
        status: 'bogus',
      }),
    ).toThrow('Invalid workspace status: bogus');
  });
});
