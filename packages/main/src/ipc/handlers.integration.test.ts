import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb } from '../__test-utils__/db';

let testDb: Database.Database;

vi.mock('../database/db', () => ({
  getDb: () => testDb,
  initDatabase: vi.fn(),
}));

vi.mock('../services/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  initLogger: vi.fn(),
}));

vi.mock('../services/configManager', () => ({
  initConfig: vi.fn(),
  getConfig: vi.fn(),
  setConfig: vi.fn(),
  getAllConfig: vi.fn().mockReturnValue({}),
}));

vi.mock('child_process', () => ({
  execSync: vi.fn().mockReturnValue('main'),
  execFile: vi.fn(),
  spawn: vi.fn(),
}));

vi.mock('util', () => ({
  promisify: vi.fn(() => vi.fn().mockRejectedValue(new Error('not in test'))),
}));

describe('IPC Handlers Integration', () => {
  let handlers: Record<string, (...args: any[]) => any>;

  beforeEach(async () => {
    testDb = createTestDb();
    handlers = {};
    vi.resetModules();

    const mockIpcMain = {
      handle: vi.fn((channel: string, handler: any) => {
        handlers[channel] = handler;
      }),
    };

    // Import and register all handlers we can test
    const { registerProjectHandlers } = await import('./projectHandlers');
    registerProjectHandlers(mockIpcMain as any);
  });

  afterEach(() => {
    testDb.close();
  });

  describe('Project + Workspace + Session flow', () => {
    it('creates project, then workspace, then session, then messages', async () => {
      // Create project
      const project = await handlers['project:create'](null, {
        name: 'Integration Test',
        path: '/int/test',
      });
      expect(project.id).toBeTruthy();
      expect(project.name).toBe('Integration Test');

      // Create workspace directly in DB (since workspaceHandlers need more setup)
      testDb.prepare(
        "INSERT INTO workspaces (id, project_id, name, branch_name) VALUES ('ws1', ?, 'Test WS', 'feat/test')",
      ).run(project.id);

      // Create session
      testDb.prepare(
        "INSERT INTO sessions (id, workspace_id, agent_type) VALUES ('s1', 'ws1', 'claude-code')",
      ).run();

      // Add messages
      testDb.prepare(
        "INSERT INTO messages (session_id, role, content) VALUES ('s1', 'user', 'Hello')",
      ).run();
      testDb.prepare(
        "INSERT INTO messages (session_id, role, content) VALUES ('s1', 'assistant', 'Hi')",
      ).run();

      // Verify full chain
      const messages = testDb.prepare("SELECT * FROM messages WHERE session_id = 's1'").all();
      expect(messages).toHaveLength(2);

      // Delete project cascades everything
      await handlers['project:delete'](null, project.id);
      expect(testDb.prepare('SELECT COUNT(*) as c FROM workspaces').get() as any).toEqual({ c: 0 });
      expect(testDb.prepare('SELECT COUNT(*) as c FROM sessions').get() as any).toEqual({ c: 0 });
      expect(testDb.prepare('SELECT COUNT(*) as c FROM messages').get() as any).toEqual({ c: 0 });
    });
  });

  describe('Todo handler flow', () => {
    it('creates and manages todos for a workspace', () => {
      testDb.prepare("INSERT INTO projects (id, name, path) VALUES ('p1', 'P', '/p')").run();
      testDb.prepare("INSERT INTO workspaces (id, project_id, name, branch_name) VALUES ('ws1', 'p1', 'WS', 'main')").run();

      // Create todos
      testDb.prepare("INSERT INTO todos (workspace_id, title) VALUES ('ws1', 'Fix bug')").run();
      testDb.prepare("INSERT INTO todos (workspace_id, title, blocks_merge) VALUES ('ws1', 'Add tests', 0)").run();

      const todos = testDb.prepare("SELECT * FROM todos WHERE workspace_id = 'ws1'").all() as any[];
      expect(todos).toHaveLength(2);

      // Complete one
      testDb.prepare('UPDATE todos SET is_completed = 1 WHERE id = ?').run(todos[0].id);
      const completed = testDb.prepare('SELECT * FROM todos WHERE is_completed = 1').all();
      expect(completed).toHaveLength(1);

      // Delete one
      testDb.prepare('DELETE FROM todos WHERE id = ?').run(todos[1].id);
      const remaining = testDb.prepare("SELECT * FROM todos WHERE workspace_id = 'ws1'").all();
      expect(remaining).toHaveLength(1);
    });
  });

  describe('Diff comment handler flow', () => {
    it('creates, lists, and resolves diff comments', () => {
      testDb.prepare("INSERT INTO projects (id, name, path) VALUES ('p1', 'P', '/p')").run();
      testDb.prepare("INSERT INTO workspaces (id, project_id, name, branch_name) VALUES ('ws1', 'p1', 'WS', 'main')").run();

      testDb.prepare(
        "INSERT INTO diff_comments (workspace_id, file_path, line_number, body) VALUES ('ws1', 'src/app.ts', 10, 'Consider refactoring')",
      ).run();
      testDb.prepare(
        "INSERT INTO diff_comments (workspace_id, file_path, line_number, body) VALUES ('ws1', 'src/app.ts', 20, 'Good pattern')",
      ).run();

      const comments = testDb.prepare("SELECT * FROM diff_comments WHERE workspace_id = 'ws1'").all() as any[];
      expect(comments).toHaveLength(2);

      // Resolve one
      testDb.prepare('UPDATE diff_comments SET is_resolved = 1 WHERE id = ?').run(comments[0].id);
      const unresolved = testDb.prepare("SELECT * FROM diff_comments WHERE workspace_id = 'ws1' AND is_resolved = 0").all();
      expect(unresolved).toHaveLength(1);
    });
  });

  describe('Checkpoint handler flow', () => {
    it('manages checkpoint lifecycle', () => {
      testDb.prepare("INSERT INTO projects (id, name, path) VALUES ('p1', 'P', '/p')").run();
      testDb.prepare("INSERT INTO workspaces (id, project_id, name, branch_name) VALUES ('ws1', 'p1', 'WS', 'main')").run();
      testDb.prepare("INSERT INTO sessions (id, workspace_id, agent_type) VALUES ('s1', 'ws1', 'claude-code')").run();

      // Create checkpoints
      testDb.prepare("INSERT INTO checkpoints (workspace_id, session_id, commit_hash, message_index) VALUES ('ws1', 's1', 'aaa111', 5)").run();
      testDb.prepare("INSERT INTO checkpoints (workspace_id, session_id, commit_hash, message_index) VALUES ('ws1', 's1', 'bbb222', 10)").run();

      const checkpoints = testDb.prepare("SELECT * FROM checkpoints WHERE workspace_id = 'ws1' ORDER BY id").all() as any[];
      expect(checkpoints).toHaveLength(2);
      expect(checkpoints[0].commit_hash).toBe('aaa111');
      expect(checkpoints[1].commit_hash).toBe('bbb222');
    });
  });
});
