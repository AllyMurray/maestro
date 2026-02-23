import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from './migrations';

describe('Database Integration', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('full CRUD cycle: project → workspace → session → messages', () => {
    // Create project
    db.prepare("INSERT INTO projects (id, name, path) VALUES ('p1', 'My App', '/path/to/app')").run();
    const project = db.prepare("SELECT * FROM projects WHERE id = 'p1'").get() as any;
    expect(project.name).toBe('My App');

    // Create workspace
    db.prepare(
      "INSERT INTO workspaces (id, project_id, name, branch_name, worktree_path) VALUES ('ws1', 'p1', 'Feature', 'feat/auth', '/worktree')",
    ).run();
    const workspace = db.prepare("SELECT * FROM workspaces WHERE id = 'ws1'").get() as any;
    expect(workspace.name).toBe('Feature');
    expect(workspace.status).toBe('active');

    // Create session
    db.prepare(
      "INSERT INTO sessions (id, workspace_id, agent_type, model) VALUES ('s1', 'ws1', 'claude-code', 'claude-sonnet-4-20250514')",
    ).run();
    const session = db.prepare("SELECT * FROM sessions WHERE id = 's1'").get() as any;
    expect(session.agent_type).toBe('claude-code');
    expect(session.status).toBe('initializing');

    // Add messages
    db.prepare(
      "INSERT INTO messages (session_id, role, content) VALUES ('s1', 'user', 'Hello')",
    ).run();
    db.prepare(
      "INSERT INTO messages (session_id, role, content, metadata_json) VALUES ('s1', 'assistant', 'Hi there', '{\"tokens\": 42}')",
    ).run();

    const messages = db.prepare("SELECT * FROM messages WHERE session_id = 's1' ORDER BY id").all() as any[];
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('user');
    expect(messages[1].role).toBe('assistant');
    expect(JSON.parse(messages[1].metadata_json).tokens).toBe(42);
  });

  it('cascading deletes: project deletion removes all children', () => {
    // Set up full hierarchy
    db.prepare("INSERT INTO projects (id, name, path) VALUES ('p1', 'App', '/app')").run();
    db.prepare("INSERT INTO workspaces (id, project_id, name, branch_name) VALUES ('ws1', 'p1', 'WS', 'main')").run();
    db.prepare("INSERT INTO sessions (id, workspace_id, agent_type) VALUES ('s1', 'ws1', 'claude-code')").run();
    db.prepare("INSERT INTO messages (session_id, role, content) VALUES ('s1', 'user', 'Hello')").run();
    db.prepare("INSERT INTO checkpoints (workspace_id, session_id, commit_hash) VALUES ('ws1', 's1', 'abc')").run();
    db.prepare("INSERT INTO todos (workspace_id, title) VALUES ('ws1', 'Fix bug')").run();
    db.prepare("INSERT INTO linked_issues (workspace_id, source, issue_id) VALUES ('ws1', 'github', '42')").run();
    db.prepare("INSERT INTO diff_comments (workspace_id, file_path, line_number, body) VALUES ('ws1', 'test.ts', 10, 'Nice')").run();

    // Delete project
    db.prepare("DELETE FROM projects WHERE id = 'p1'").run();

    // Verify everything is gone
    expect(db.prepare('SELECT COUNT(*) as c FROM workspaces').get() as any).toEqual({ c: 0 });
    expect(db.prepare('SELECT COUNT(*) as c FROM sessions').get() as any).toEqual({ c: 0 });
    expect(db.prepare('SELECT COUNT(*) as c FROM messages').get() as any).toEqual({ c: 0 });
    expect(db.prepare('SELECT COUNT(*) as c FROM checkpoints').get() as any).toEqual({ c: 0 });
    expect(db.prepare('SELECT COUNT(*) as c FROM todos').get() as any).toEqual({ c: 0 });
    expect(db.prepare('SELECT COUNT(*) as c FROM linked_issues').get() as any).toEqual({ c: 0 });
    expect(db.prepare('SELECT COUNT(*) as c FROM diff_comments').get() as any).toEqual({ c: 0 });
  });

  it('foreign key constraint enforcement', () => {
    // workspace without project should fail
    expect(() =>
      db.prepare("INSERT INTO workspaces (id, project_id, name, branch_name) VALUES ('ws1', 'nonexistent', 'WS', 'main')").run(),
    ).toThrow();

    // session without workspace should fail
    db.prepare("INSERT INTO projects (id, name, path) VALUES ('p1', 'App', '/app')").run();
    expect(() =>
      db.prepare("INSERT INTO sessions (id, workspace_id, agent_type) VALUES ('s1', 'nonexistent', 'claude-code')").run(),
    ).toThrow();
  });

  it('unique path constraint on projects', () => {
    db.prepare("INSERT INTO projects (id, name, path) VALUES ('p1', 'App1', '/same/path')").run();
    expect(() =>
      db.prepare("INSERT INTO projects (id, name, path) VALUES ('p2', 'App2', '/same/path')").run(),
    ).toThrow();
  });

  it('config table CRUD operations', () => {
    db.prepare("INSERT INTO config (key, value) VALUES ('api_key', 'sk-test')").run();
    const config = db.prepare("SELECT * FROM config WHERE key = 'api_key'").get() as any;
    expect(config.value).toBe('sk-test');

    db.prepare("UPDATE config SET value = 'sk-updated' WHERE key = 'api_key'").run();
    const updated = db.prepare("SELECT * FROM config WHERE key = 'api_key'").get() as any;
    expect(updated.value).toBe('sk-updated');

    db.prepare("DELETE FROM config WHERE key = 'api_key'").run();
    const deleted = db.prepare("SELECT * FROM config WHERE key = 'api_key'").get();
    expect(deleted).toBeUndefined();
  });

  it('todo operations with blocks_merge flag', () => {
    db.prepare("INSERT INTO projects (id, name, path) VALUES ('p1', 'App', '/app')").run();
    db.prepare("INSERT INTO workspaces (id, project_id, name, branch_name) VALUES ('ws1', 'p1', 'WS', 'main')").run();

    db.prepare("INSERT INTO todos (workspace_id, title, blocks_merge) VALUES ('ws1', 'Critical fix', 1)").run();
    db.prepare("INSERT INTO todos (workspace_id, title, blocks_merge) VALUES ('ws1', 'Nice to have', 0)").run();

    const blockers = db.prepare(
      "SELECT * FROM todos WHERE workspace_id = 'ws1' AND blocks_merge = 1 AND is_completed = 0",
    ).all();
    expect(blockers).toHaveLength(1);

    // Complete the blocker
    db.prepare('UPDATE todos SET is_completed = 1 WHERE id = ?').run((blockers[0] as any).id);
    const remainingBlockers = db.prepare(
      "SELECT * FROM todos WHERE workspace_id = 'ws1' AND blocks_merge = 1 AND is_completed = 0",
    ).all();
    expect(remainingBlockers).toHaveLength(0);
  });

  it('diff_comments resolve workflow', () => {
    db.prepare("INSERT INTO projects (id, name, path) VALUES ('p1', 'App', '/app')").run();
    db.prepare("INSERT INTO workspaces (id, project_id, name, branch_name) VALUES ('ws1', 'p1', 'WS', 'main')").run();

    db.prepare(
      "INSERT INTO diff_comments (workspace_id, file_path, line_number, body) VALUES ('ws1', 'src/index.ts', 42, 'Refactor this')",
    ).run();

    const comment = db.prepare("SELECT * FROM diff_comments WHERE workspace_id = 'ws1'").get() as any;
    expect(comment.is_resolved).toBe(0);

    db.prepare('UPDATE diff_comments SET is_resolved = 1 WHERE id = ?').run(comment.id);
    const resolved = db.prepare('SELECT * FROM diff_comments WHERE id = ?').get(comment.id) as any;
    expect(resolved.is_resolved).toBe(1);
  });

  it('migration idempotency', () => {
    // Running migrations again should not error
    runMigrations(db);
    runMigrations(db);

    const migrationCount = db.prepare('SELECT COUNT(*) as c FROM _migrations').get() as any;
    expect(migrationCount.c).toBe(2);
  });
});
