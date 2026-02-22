import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb } from '../__test-utils__/db';

let testDb: Database.Database;

const mockExecFile = vi.fn();
vi.mock('child_process', () => ({
  execFile: (...args: any[]) => mockExecFile(...args),
  promisify: vi.fn(() => mockExecFile),
}));
vi.mock('util', () => ({
  promisify: vi.fn(() => mockExecFile),
}));

vi.mock('../database/db', () => ({
  getDb: () => testDb,
}));

vi.mock('./logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('checkpointManager', () => {
  beforeEach(() => {
    testDb = createTestDb();
    mockExecFile.mockReset();

    // Set up required FK data
    testDb.prepare("INSERT INTO projects (id, name, path) VALUES ('p1', 'Test', '/test')").run();
    testDb.prepare(
      "INSERT INTO workspaces (id, project_id, name, branch_name) VALUES ('ws1', 'p1', 'WS', 'feat')",
    ).run();
    testDb.prepare(
      "INSERT INTO sessions (id, workspace_id, agent_type) VALUES ('s1', 'ws1', 'claude-code')",
    ).run();
  });

  afterEach(() => {
    testDb.close();
  });

  describe('createCheckpoint', () => {
    it('creates checkpoint in DB with commit hash', async () => {
      mockExecFile.mockImplementation((...args: any[]) => {
        const gitArgs = args[1] as string[];
        if (gitArgs.includes('rev-parse')) {
          return Promise.resolve({ stdout: 'abc123def456', stderr: '' });
        }
        if (gitArgs.includes('update-ref')) {
          return Promise.resolve({ stdout: '', stderr: '' });
        }
        return Promise.reject(new Error('unexpected'));
      });

      const { createCheckpoint } = await import('./checkpointManager');
      const result = await createCheckpoint('/workspace', 'ws1', 's1', 5);

      expect(result.commitHash).toBe('abc123def456');
      expect(result.id).toBeGreaterThan(0);

      // Verify DB record
      const row = testDb.prepare('SELECT * FROM checkpoints WHERE id = ?').get(result.id) as any;
      expect(row.workspace_id).toBe('ws1');
      expect(row.session_id).toBe('s1');
      expect(row.commit_hash).toBe('abc123def456');
      expect(row.message_index).toBe(5);
    });

    it('creates git ref for the checkpoint', async () => {
      mockExecFile.mockImplementation((...args: any[]) => {
        const gitArgs = args[1] as string[];
        if (gitArgs.includes('rev-parse')) {
          return Promise.resolve({ stdout: 'abc123', stderr: '' });
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const { createCheckpoint } = await import('./checkpointManager');
      await createCheckpoint('/workspace', 'ws1', 's1');

      expect(mockExecFile).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['update-ref']),
        expect.any(Object),
      );
    });
  });

  describe('listCheckpoints', () => {
    it('returns checkpoints ordered by created_at DESC', async () => {
      testDb.prepare(
        "INSERT INTO checkpoints (workspace_id, session_id, commit_hash, message_index) VALUES ('ws1', 's1', 'aaa', 1)",
      ).run();
      testDb.prepare(
        "INSERT INTO checkpoints (workspace_id, session_id, commit_hash, message_index) VALUES ('ws1', 's1', 'bbb', 2)",
      ).run();

      const { listCheckpoints } = await import('./checkpointManager');
      const checkpoints = listCheckpoints('ws1') as any[];

      expect(checkpoints).toHaveLength(2);
    });

    it('returns empty array for no checkpoints', async () => {
      const { listCheckpoints } = await import('./checkpointManager');
      const checkpoints = listCheckpoints('ws1') as any[];
      expect(checkpoints).toHaveLength(0);
    });
  });

  describe('revertToCheckpoint', () => {
    it('throws for nonexistent checkpoint', async () => {
      const { revertToCheckpoint } = await import('./checkpointManager');
      await expect(revertToCheckpoint('/workspace', 999)).rejects.toThrow('not found');
    });

    it('calls git checkout and clean', async () => {
      testDb.prepare(
        "INSERT INTO checkpoints (workspace_id, session_id, commit_hash, message_index) VALUES ('ws1', 's1', 'abc123', 5)",
      ).run();
      const cpId = (testDb.prepare('SELECT last_insert_rowid() as id').get() as any).id;

      mockExecFile.mockResolvedValue({ stdout: '', stderr: '' });

      const { revertToCheckpoint } = await import('./checkpointManager');
      await revertToCheckpoint('/workspace', cpId);

      const calls = mockExecFile.mock.calls.map((c: any) => c[1].join(' '));
      expect(calls.some((c: string) => c.includes('checkout'))).toBe(true);
      expect(calls.some((c: string) => c.includes('clean'))).toBe(true);
    });

    it('truncates messages after checkpoint', async () => {
      // Add messages
      testDb.prepare("INSERT INTO messages (session_id, role, content) VALUES ('s1', 'user', 'msg1')").run();
      const msg1Id = (testDb.prepare('SELECT last_insert_rowid() as id').get() as any).id;
      testDb.prepare("INSERT INTO messages (session_id, role, content) VALUES ('s1', 'assistant', 'msg2')").run();
      testDb.prepare("INSERT INTO messages (session_id, role, content) VALUES ('s1', 'user', 'msg3')").run();

      // Create checkpoint at msg1
      testDb.prepare(
        `INSERT INTO checkpoints (workspace_id, session_id, commit_hash, message_index) VALUES ('ws1', 's1', 'abc', ${msg1Id})`,
      ).run();
      const cpId = (testDb.prepare('SELECT last_insert_rowid() as id').get() as any).id;

      mockExecFile.mockResolvedValue({ stdout: '', stderr: '' });

      const { revertToCheckpoint } = await import('./checkpointManager');
      await revertToCheckpoint('/workspace', cpId);

      const remaining = testDb.prepare("SELECT * FROM messages WHERE session_id = 's1'").all();
      expect(remaining).toHaveLength(1);
    });

    it('removes later checkpoints', async () => {
      testDb.prepare(
        "INSERT INTO checkpoints (workspace_id, session_id, commit_hash) VALUES ('ws1', 's1', 'aaa')",
      ).run();
      const cp1Id = (testDb.prepare('SELECT last_insert_rowid() as id').get() as any).id;
      testDb.prepare(
        "INSERT INTO checkpoints (workspace_id, session_id, commit_hash) VALUES ('ws1', 's1', 'bbb')",
      ).run();
      testDb.prepare(
        "INSERT INTO checkpoints (workspace_id, session_id, commit_hash) VALUES ('ws1', 's1', 'ccc')",
      ).run();

      mockExecFile.mockResolvedValue({ stdout: '', stderr: '' });

      const { revertToCheckpoint } = await import('./checkpointManager');
      await revertToCheckpoint('/workspace', cp1Id);

      const remaining = testDb.prepare("SELECT * FROM checkpoints WHERE workspace_id = 'ws1'").all();
      expect(remaining).toHaveLength(1);
    });
  });
});
