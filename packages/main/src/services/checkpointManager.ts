import { execFile } from 'child_process';
import { promisify } from 'util';
import { getDb } from '../database/db';
import { mapRows } from '../database/mapRow';
import { logger } from './logger';

const execFileAsync = promisify(execFile);

async function git(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd, timeout: 10000 });
  return stdout.trim();
}

export async function createCheckpoint(
  workspacePath: string,
  workspaceId: string,
  sessionId: string,
  messageIndex?: number,
): Promise<{ id: number; commitHash: string }> {
  // Get current HEAD
  const commitHash = await git(workspacePath, 'rev-parse', 'HEAD');

  // Create a ref for the checkpoint
  const timestamp = Date.now();
  const refName = `refs/maestro/checkpoints/${workspaceId}/${timestamp}`;
  await git(workspacePath, 'update-ref', refName, commitHash);

  // Store in database
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO checkpoints (workspace_id, session_id, commit_hash, message_index)
       VALUES (?, ?, ?, ?)`,
    )
    .run(workspaceId, sessionId, commitHash, messageIndex ?? null);

  const id = result.lastInsertRowid as number;
  logger.info(`Checkpoint ${id} created at ${commitHash.substring(0, 8)} for workspace ${workspaceId}`);

  return { id, commitHash };
}

export function listCheckpoints(workspaceId: string) {
  const db = getDb();
  return mapRows(
    db.prepare('SELECT * FROM checkpoints WHERE workspace_id = ? ORDER BY created_at DESC').all(workspaceId) as Record<string, unknown>[],
  );
}

export async function revertToCheckpoint(
  workspacePath: string,
  checkpointId: number,
): Promise<void> {
  const db = getDb();
  const checkpoint = db.prepare('SELECT * FROM checkpoints WHERE id = ?').get(checkpointId) as {
    id: number;
    workspace_id: string;
    session_id: string;
    commit_hash: string;
    message_index: number | null;
  } | undefined;

  if (!checkpoint) {
    throw new Error(`Checkpoint ${checkpointId} not found`);
  }

  // Reset worktree to checkpoint commit
  await git(workspacePath, 'checkout', checkpoint.commit_hash, '--', '.');
  await git(workspacePath, 'clean', '-fd');

  // Truncate messages after checkpoint
  if (checkpoint.message_index !== null) {
    db.prepare(
      `DELETE FROM messages WHERE session_id = ? AND id > ?`,
    ).run(checkpoint.session_id, checkpoint.message_index);
  }

  // Remove checkpoints after this one
  db.prepare(
    `DELETE FROM checkpoints WHERE workspace_id = ? AND id > ?`,
  ).run(checkpoint.workspace_id, checkpointId);

  logger.info(`Reverted to checkpoint ${checkpointId} (${checkpoint.commit_hash.substring(0, 8)})`);
}
