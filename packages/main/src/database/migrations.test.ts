import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from './migrations';

function createFreshDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

describe('runMigrations', () => {
  it('creates all expected tables', () => {
    const db = createFreshDb();
    runMigrations(db);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all()
      .map((r: any) => r.name)
      .sort();

    expect(tables).toEqual([
      '_migrations',
      'checkpoints',
      'config',
      'diff_comments',
      'linked_issues',
      'messages',
      'projects',
      'sessions',
      'todos',
      'workspaces',
    ]);

    db.close();
  });

  it('records migration versions', () => {
    const db = createFreshDb();
    runMigrations(db);

    const migrations = db
      .prepare('SELECT version, name FROM _migrations ORDER BY version')
      .all() as any[];
    expect(migrations).toHaveLength(3);
    expect(migrations[0].version).toBe(1);
    expect(migrations[0].name).toBe('initial_schema');
    expect(migrations[1].version).toBe(2);
    expect(migrations[1].name).toBe('add_workspace_agent_type');
    expect(migrations[2].version).toBe(3);
    expect(migrations[2].name).toBe('workspace_status_expansion');

    db.close();
  });

  it('is idempotent - running twice does not error', () => {
    const db = createFreshDb();
    runMigrations(db);
    runMigrations(db);

    const migrations = db.prepare('SELECT version FROM _migrations').all();
    expect(migrations).toHaveLength(3);

    db.close();
  });

  it('creates projects table with correct columns', () => {
    const db = createFreshDb();
    runMigrations(db);

    const info = db.pragma('table_info(projects)') as any[];
    const columns = info.map((c) => c.name);
    expect(columns).toContain('id');
    expect(columns).toContain('name');
    expect(columns).toContain('path');
    expect(columns).toContain('git_platform');
    expect(columns).toContain('default_branch');
    expect(columns).toContain('settings_json');
    expect(columns).toContain('created_at');

    db.close();
  });

  it('enforces foreign keys between workspaces and projects', () => {
    const db = createFreshDb();
    runMigrations(db);

    expect(() => {
      db.prepare(
        "INSERT INTO workspaces (id, project_id, name, branch_name) VALUES ('ws1', 'nonexistent', 'test', 'main')",
      ).run();
    }).toThrow();

    db.close();
  });

  it('adds agent_type column to workspaces with default', () => {
    const db = createFreshDb();
    runMigrations(db);

    const info = db.pragma('table_info(workspaces)') as any[];
    const agentTypeCol = info.find((c) => c.name === 'agent_type');
    expect(agentTypeCol).toBeDefined();
    expect(agentTypeCol.dflt_value).toBe("'claude-code'");

    // Verify default value works
    db.prepare("INSERT INTO projects (id, name, path) VALUES ('p1', 'Test', '/test')").run();
    db.prepare(
      "INSERT INTO workspaces (id, project_id, name, branch_name) VALUES ('ws1', 'p1', 'WS', 'main')",
    ).run();
    const ws = db.prepare("SELECT agent_type FROM workspaces WHERE id = 'ws1'").get() as any;
    expect(ws.agent_type).toBe('claude-code');

    db.close();
  });

  it('cascades deletes from projects to workspaces', () => {
    const db = createFreshDb();
    runMigrations(db);

    db.prepare("INSERT INTO projects (id, name, path) VALUES ('p1', 'Test', '/test')").run();
    db.prepare(
      "INSERT INTO workspaces (id, project_id, name, branch_name) VALUES ('ws1', 'p1', 'Workspace', 'feat')",
    ).run();

    db.prepare("DELETE FROM projects WHERE id = 'p1'").run();

    const workspaces = db.prepare('SELECT * FROM workspaces').all();
    expect(workspaces).toHaveLength(0);

    db.close();
  });
});
