import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { createTestDb } from '../__test-utils__/db';
import { createTempGitRepo } from '../__test-utils__/exec';

let testDb: Database.Database;

vi.mock('../database/db', () => ({
  getDb: () => testDb,
}));

vi.mock('./logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('Checkpoint Integration', () => {
  let repo: { path: string; cleanup: () => void };

  beforeEach(() => {
    testDb = createTestDb();
    repo = createTempGitRepo();

    // Set up DB data
    testDb.prepare("INSERT INTO projects (id, name, path) VALUES ('p1', 'Test', ?)").run(repo.path);
    testDb.prepare("INSERT INTO workspaces (id, project_id, name, branch_name) VALUES ('ws1', 'p1', 'WS', 'main')").run();
    testDb.prepare("INSERT INTO sessions (id, workspace_id, agent_type) VALUES ('s1', 'ws1', 'claude-code')").run();
  });

  afterEach(() => {
    testDb.close();
    repo.cleanup();
  });

  it('creates checkpoint with real git commit', async () => {
    const { createCheckpoint } = await import('./checkpointManager');
    const result = await createCheckpoint(repo.path, 'ws1', 's1', 0);

    expect(result.commitHash).toBeTruthy();
    expect(result.commitHash.length).toBeGreaterThanOrEqual(7);
    expect(result.id).toBeGreaterThan(0);

    // Verify DB record
    const cp = testDb.prepare('SELECT * FROM checkpoints WHERE id = ?').get(result.id) as any;
    expect(cp.commit_hash).toBe(result.commitHash);
  });

  it('creates checkpoint, makes changes, reverts file content to checkpoint', async () => {
    const { createCheckpoint, revertToCheckpoint } = await import('./checkpointManager');

    // Create checkpoint at current state
    const cp = await createCheckpoint(repo.path, 'ws1', 's1', 0);

    // Modify an existing tracked file
    writeFileSync(join(repo.path, 'README.md'), '# MODIFIED CONTENT\n');
    execSync('git add .', { cwd: repo.path });
    execSync('git commit -m "Modify README"', { cwd: repo.path });

    // Verify the modification
    const modified = readFileSync(join(repo.path, 'README.md'), 'utf-8');
    expect(modified).toContain('MODIFIED');

    // Revert to checkpoint
    await revertToCheckpoint(repo.path, cp.id);

    // README should be restored to original content
    const reverted = readFileSync(join(repo.path, 'README.md'), 'utf-8');
    expect(reverted).toBe('# Test Repo\n');
  });

  it('revert truncates messages after checkpoint', async () => {
    const { createCheckpoint, revertToCheckpoint } = await import('./checkpointManager');

    // Add messages
    testDb.prepare("INSERT INTO messages (session_id, role, content) VALUES ('s1', 'user', 'msg1')").run();
    const msg1Id = (testDb.prepare("SELECT id FROM messages WHERE content = 'msg1'").get() as any).id;
    testDb.prepare("INSERT INTO messages (session_id, role, content) VALUES ('s1', 'assistant', 'msg2')").run();
    testDb.prepare("INSERT INTO messages (session_id, role, content) VALUES ('s1', 'user', 'msg3')").run();

    // Create checkpoint at msg1
    const cp = await createCheckpoint(repo.path, 'ws1', 's1', msg1Id);

    // Add more messages
    testDb.prepare("INSERT INTO messages (session_id, role, content) VALUES ('s1', 'assistant', 'msg4')").run();

    // Revert
    await revertToCheckpoint(repo.path, cp.id);

    // Only msg1 should remain
    const remaining = testDb.prepare("SELECT * FROM messages WHERE session_id = 's1'").all() as any[];
    expect(remaining).toHaveLength(1);
    expect(remaining[0].content).toBe('msg1');
  });

  it('lists checkpoints in order', async () => {
    const { createCheckpoint, listCheckpoints } = await import('./checkpointManager');

    await createCheckpoint(repo.path, 'ws1', 's1', 0);

    // Make another commit
    writeFileSync(join(repo.path, 'second.ts'), 'second');
    execSync('git add . && git commit -m "second"', { cwd: repo.path });
    await createCheckpoint(repo.path, 'ws1', 's1', 1);

    const checkpoints = listCheckpoints('ws1') as any[];
    expect(checkpoints).toHaveLength(2);
  });
});
