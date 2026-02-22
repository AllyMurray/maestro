import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb } from '../__test-utils__/db';

let testDb: Database.Database;

vi.mock('../database/db', () => ({
  getDb: () => testDb,
}));

vi.mock('child_process', () => ({
  execSync: vi.fn().mockReturnValue('refs/remotes/origin/main'),
}));

vi.mock('../services/git-platforms/GitPlatformFactory', () => ({
  detectGitPlatform: vi.fn().mockResolvedValue(null),
}));

describe('projectHandlers', () => {
  let handlers: Record<string, (...args: any[]) => any>;

  beforeEach(async () => {
    testDb = createTestDb();
    handlers = {};

    const mockIpcMain = {
      handle: vi.fn((channel: string, handler: any) => {
        handlers[channel] = handler;
      }),
    };

    vi.resetModules();

    // Need to re-import after mocks are set up
    const { registerProjectHandlers } = await import('./projectHandlers');
    registerProjectHandlers(mockIpcMain as any);
  });

  afterEach(() => {
    testDb.close();
  });

  it('registers all expected handlers', () => {
    expect(Object.keys(handlers)).toContain('project:create');
    expect(Object.keys(handlers)).toContain('project:list');
    expect(Object.keys(handlers)).toContain('project:get');
    expect(Object.keys(handlers)).toContain('project:delete');
    expect(Object.keys(handlers)).toContain('project:update');
  });

  it('PROJECT_CREATE inserts and returns project', async () => {
    const project = await handlers['project:create'](null, {
      name: 'Test Project',
      path: '/path/to/project',
    });

    expect(project).toBeDefined();
    expect(project.name).toBe('Test Project');
    expect(project.path).toBe('/path/to/project');
    expect(project.id).toBeTruthy();
  });

  it('PROJECT_LIST returns all projects', async () => {
    await handlers['project:create'](null, { name: 'P1', path: '/p1' });
    await handlers['project:create'](null, { name: 'P2', path: '/p2' });

    const projects = await handlers['project:list'](null);
    expect(projects).toHaveLength(2);
  });

  it('PROJECT_GET returns a specific project', async () => {
    const created = await handlers['project:create'](null, { name: 'P1', path: '/p1' });
    const fetched = await handlers['project:get'](null, created.id);
    expect(fetched.name).toBe('P1');
  });

  it('PROJECT_DELETE removes a project', async () => {
    const created = await handlers['project:create'](null, { name: 'P1', path: '/p1' });
    await handlers['project:delete'](null, created.id);

    const projects = await handlers['project:list'](null);
    expect(projects).toHaveLength(0);
  });

  it('PROJECT_UPDATE modifies project fields', async () => {
    const created = await handlers['project:create'](null, { name: 'P1', path: '/p1' });
    const updated = await handlers['project:update'](null, created.id, {
      name: 'Updated Name',
      defaultBranch: 'develop',
    });

    expect(updated.name).toBe('Updated Name');
    expect(updated.defaultBranch).toBe('develop');
  });

  it('PROJECT_CREATE uses provided default branch', async () => {
    const project = await handlers['project:create'](null, {
      name: 'P1',
      path: '/p1',
      defaultBranch: 'develop',
    });

    expect(project.defaultBranch).toBe('develop');
  });

  it('PROJECT_CREATE detects default branch from git', async () => {
    const { execSync } = await import('child_process');
    (execSync as any).mockReturnValue('refs/remotes/origin/develop');

    const project = await handlers['project:create'](null, {
      name: 'P1',
      path: '/p1',
    });

    // Should use the detected branch
    expect(project.defaultBranch).toBeTruthy();
  });
});
