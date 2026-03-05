import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb } from '../__test-utils__/db';

let testDb: Database.Database;

vi.mock('../database/db', () => ({
  getDb: () => testDb,
  initDatabase: vi.fn(),
}));

vi.mock('./logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('sessionManager', () => {
  beforeEach(() => {
    testDb = createTestDb();
    // Insert a project and workspace for FK constraints
    testDb.prepare("INSERT INTO projects (id, name, path) VALUES ('p1', 'Test', '/test')").run();
    testDb
      .prepare(
        "INSERT INTO workspaces (id, project_id, name, branch_name) VALUES ('ws1', 'p1', 'WS', 'main')",
      )
      .run();
  });

  afterEach(() => {
    testDb.close();
  });

  it('createSession inserts and returns a session', async () => {
    const { createSession } = await import('./sessionManager');
    const session = createSession('ws1', 'claude-code', 'claude-sonnet-4-20250514');

    expect(session).toBeDefined();
    expect(session.id).toBeTruthy();
    expect(session.workspaceId).toBe('ws1');
    expect(session.agentType).toBe('claude-code');
    expect(session.model).toBe('claude-sonnet-4-20250514');
    expect(session.status).toBe('initializing');
  });

  it('getSession retrieves existing session', async () => {
    const { createSession, getSession } = await import('./sessionManager');
    const created = createSession('ws1', 'codex');
    const fetched = getSession(created.id);
    expect(fetched).toBeDefined();
    expect(fetched!.id).toBe(created.id);
  });

  it('getSession returns null for missing ID', async () => {
    const { getSession } = await import('./sessionManager');
    expect(getSession('nonexistent')).toBeNull();
  });

  it('listSessions returns all sessions for a workspace', async () => {
    const { createSession, listSessions } = await import('./sessionManager');
    createSession('ws1', 'claude-code');
    createSession('ws1', 'codex');

    const sessions = listSessions('ws1');
    expect(sessions).toHaveLength(2);
  });

  it('updateSessionStatus changes the status', async () => {
    const { createSession, getSession, updateSessionStatus } = await import('./sessionManager');
    const session = createSession('ws1', 'claude-code');
    updateSessionStatus(session.id, 'running');

    const updated = getSession(session.id);
    expect(updated!.status).toBe('running');
  });

  it('setAgentSessionId stores agent session ID', async () => {
    const { createSession, getSession, setAgentSessionId } = await import('./sessionManager');
    const session = createSession('ws1', 'claude-code');
    setAgentSessionId(session.id, 'agent-abc-123');

    const updated = getSession(session.id);
    expect(updated!.agentSessionId).toBe('agent-abc-123');
  });

  it('addMessage inserts a message and returns its ID', async () => {
    const { createSession, addMessage } = await import('./sessionManager');
    const session = createSession('ws1', 'claude-code');
    const msgId = addMessage(session.id, 'user', 'Hello world');
    expect(msgId).toBeGreaterThan(0);
  });

  it('getMessages returns messages in order', async () => {
    const { createSession, addMessage, getMessages } = await import('./sessionManager');
    const session = createSession('ws1', 'claude-code');
    addMessage(session.id, 'user', 'First');
    addMessage(session.id, 'assistant', 'Second');
    addMessage(session.id, 'user', 'Third');

    const messages = getMessages(session.id) as any[];
    expect(messages).toHaveLength(3);
    expect(messages[0].content).toBe('First');
    expect(messages[1].content).toBe('Second');
    expect(messages[2].content).toBe('Third');
  });

  it('getMessages supports limit and offset', async () => {
    const { createSession, addMessage, getMessages } = await import('./sessionManager');
    const session = createSession('ws1', 'claude-code');
    addMessage(session.id, 'user', 'One');
    addMessage(session.id, 'assistant', 'Two');
    addMessage(session.id, 'user', 'Three');

    const limited = getMessages(session.id, 2) as any[];
    expect(limited).toHaveLength(2);

    const offset = getMessages(session.id, 10, 1) as any[];
    expect(offset).toHaveLength(2);
    expect(offset[0].content).toBe('Two');
  });

  it('addMessage stores metadata as JSON', async () => {
    const { createSession, addMessage, getMessages } = await import('./sessionManager');
    const session = createSession('ws1', 'claude-code');
    addMessage(session.id, 'tool_call', 'call', { toolName: 'Read' });

    const messages = getMessages(session.id) as any[];
    const parsed = JSON.parse(messages[0].metadataJson);
    expect(parsed.toolName).toBe('Read');
  });

  it('clearSessionHistory deletes messages/checkpoints and resets resume state', async () => {
    const { createSession, addMessage, clearSessionHistory, setAgentSessionId } =
      await import('./sessionManager');
    const session = createSession('ws1', 'claude-code');
    addMessage(session.id, 'user', 'hello');
    addMessage(session.id, 'assistant', 'world');
    setAgentSessionId(session.id, 'agent-session-123');

    testDb
      .prepare(
        `INSERT INTO checkpoints (workspace_id, session_id, commit_hash, message_index)
         VALUES (?, ?, ?, ?)`,
      )
      .run('ws1', session.id, 'abc123', 1);

    clearSessionHistory(session.id);

    const messageCount = testDb
      .prepare('SELECT COUNT(*) AS count FROM messages WHERE session_id = ?')
      .get(session.id) as { count: number };
    const checkpointCount = testDb
      .prepare('SELECT COUNT(*) AS count FROM checkpoints WHERE session_id = ?')
      .get(session.id) as { count: number };
    const persistedSession = testDb
      .prepare('SELECT id, agent_session_id FROM sessions WHERE id = ?')
      .get(session.id) as { id: string; agent_session_id: string | null } | undefined;

    expect(messageCount.count).toBe(0);
    expect(checkpointCount.count).toBe(0);
    expect(persistedSession?.id).toBe(session.id);
    expect(persistedSession?.agent_session_id).toBeNull();
  });
});
