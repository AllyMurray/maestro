import { v4 as uuid } from 'uuid';
import { getDb } from '../database/db';
import { mapRow, mapRows } from '../database/mapRow';
import { logger } from './logger';
import type { Session, SessionStatus, AgentType } from '@maestro/shared';

export function createSession(workspaceId: string, agentType: AgentType, model?: string): Session {
  const db = getDb();
  const id = uuid();

  db.prepare(
    `INSERT INTO sessions (id, workspace_id, agent_type, model)
     VALUES (?, ?, ?, ?)`,
  ).run(id, workspaceId, agentType, model || null);

  logger.info(`Session created: ${id} (${agentType}) for workspace ${workspaceId}`);

  return mapRow<Session>(
    db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Record<string, unknown>,
  );
}

export function getSession(id: string): Session | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
  return row ? mapRow<Session>(row as Record<string, unknown>) : null;
}

export function listSessions(workspaceId: string): Session[] {
  const db = getDb();
  return mapRows<Session>(
    db
      .prepare('SELECT * FROM sessions WHERE workspace_id = ? ORDER BY created_at DESC')
      .all(workspaceId) as Record<string, unknown>[],
  );
}

export function updateSessionStatus(id: string, status: SessionStatus): void {
  const db = getDb();
  db.prepare('UPDATE sessions SET status = ? WHERE id = ?').run(status, id);
  logger.info(`Session ${id} status changed to ${status}`);
}

export function setAgentSessionId(id: string, agentSessionId: string): void {
  const db = getDb();
  db.prepare('UPDATE sessions SET agent_session_id = ? WHERE id = ?').run(agentSessionId, id);
}

export function addMessage(
  sessionId: string,
  role: string,
  content: string,
  metadata?: Record<string, unknown>,
): number {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO messages (session_id, role, content, metadata_json)
       VALUES (?, ?, ?, ?)`,
    )
    .run(sessionId, role, content, JSON.stringify(metadata || {}));

  return result.lastInsertRowid as number;
}

export function getMessages(sessionId: string, limit?: number, offset?: number) {
  const db = getDb();
  let query = 'SELECT * FROM messages WHERE session_id = ? ORDER BY id ASC';
  const params: unknown[] = [sessionId];

  if (limit) {
    query += ' LIMIT ?';
    params.push(limit);
  }
  if (offset) {
    query += ' OFFSET ?';
    params.push(offset);
  }

  return mapRows(db.prepare(query).all(...params) as Record<string, unknown>[]);
}

export function clearSessionHistory(sessionId: string): void {
  const db = getDb();
  const session = db.prepare('SELECT id FROM sessions WHERE id = ?').get(sessionId) as
    | { id: string }
    | undefined;

  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  db.transaction(() => {
    db.prepare('DELETE FROM messages WHERE session_id = ?').run(sessionId);
    db.prepare('DELETE FROM checkpoints WHERE session_id = ?').run(sessionId);
    db.prepare('UPDATE sessions SET agent_session_id = NULL WHERE id = ?').run(sessionId);
  })();

  logger.info(`Cleared history for session ${sessionId}`);
}
