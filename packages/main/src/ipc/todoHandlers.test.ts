import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb } from '../__test-utils__/db';

let testDb: Database.Database;

vi.mock('../database/db', () => ({
  getDb: () => testDb,
}));

describe('todoHandlers', () => {
  let handlers: Record<string, (...args: any[]) => any>;

  beforeEach(async () => {
    testDb = createTestDb();
    handlers = {};

    testDb
      .prepare("INSERT INTO projects (id, name, path) VALUES ('p1', 'Test Project', '/tmp/test')")
      .run();
    testDb
      .prepare(
        "INSERT INTO workspaces (id, project_id, name, branch_name, status) VALUES ('w1', 'p1', 'Workspace 1', 'feat/test', 'in_progress')",
      )
      .run();

    const mockIpcMain = {
      handle: vi.fn((channel: string, handler: any) => {
        handlers[channel] = handler;
      }),
    };

    vi.resetModules();
    const { registerTodoHandlers } = await import('./todoHandlers');
    registerTodoHandlers(mockIpcMain as any);
  });

  afterEach(() => {
    testDb.close();
  });

  it('registers todo handlers', () => {
    expect(Object.keys(handlers)).toEqual(
      expect.arrayContaining(['todo:create', 'todo:list', 'todo:update', 'todo:delete']),
    );
  });

  it('creates and lists todos', () => {
    const created = handlers['todo:create'](null, {
      workspaceId: 'w1',
      title: 'Ship feature',
      blocksMerge: true,
    });

    expect(created.id).toBeTruthy();

    const todos = handlers['todo:list'](null, 'w1');
    expect(todos).toHaveLength(1);
    expect(todos[0].title).toBe('Ship feature');
    expect(todos[0].blocksMerge).toBe(1);
    expect(todos[0].isCompleted).toBe(0);
  });

  it('updates completion, title and blocker fields', () => {
    const created = handlers['todo:create'](null, {
      workspaceId: 'w1',
      title: 'Initial',
      blocksMerge: true,
    });

    const updated = handlers['todo:update'](null, {
      id: Number(created.id),
      isCompleted: true,
      title: 'Updated',
      blocksMerge: false,
    });

    expect(updated).toEqual({ success: true });
    const todos = handlers['todo:list'](null, 'w1');
    expect(todos[0].title).toBe('Updated');
    expect(todos[0].isCompleted).toBe(1);
    expect(todos[0].blocksMerge).toBe(0);
  });

  it('deletes a todo', () => {
    const created = handlers['todo:create'](null, {
      workspaceId: 'w1',
      title: 'Delete me',
    });

    const deleted = handlers['todo:delete'](null, Number(created.id));
    expect(deleted).toEqual({ success: true });
    expect(handlers['todo:list'](null, 'w1')).toHaveLength(0);
  });
});
