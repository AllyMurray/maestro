import { IpcMain } from 'electron';
import { IPC_CHANNELS, Workspace } from '@maestro/shared';
import type { AgentType } from '@maestro/shared';
import { getDb } from '../database/db';
import { mapRow, mapRows } from '../database/mapRow';
import { v4 as uuid } from 'uuid';
import { createWorktree, getWorktreePath, removeWorktree } from '../services/worktreeManager';
import { logger } from '../services/logger';

export function registerWorkspaceHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_CREATE,
    async (
      _event,
      data: {
        projectId: string;
        name: string;
        branchName: string;
        targetBranch?: string;
        agentType?: AgentType;
      },
    ) => {
      const db = getDb();
      const id = uuid();

      // Look up the project to get the repo path
      const projectRow = db.prepare('SELECT * FROM projects WHERE id = ?').get(data.projectId) as Record<string, unknown> | undefined;
      if (!projectRow) {
        throw new Error(`Project not found: ${data.projectId}`);
      }
      const repoPath = projectRow.path as string;

      // Create the git worktree
      const worktreePath = getWorktreePath(repoPath, data.branchName);
      await createWorktree(repoPath, data.branchName, worktreePath);

      db.prepare(
        `INSERT INTO workspaces (id, project_id, name, branch_name, worktree_path, target_branch, agent_type)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(id, data.projectId, data.name, data.branchName, worktreePath, data.targetBranch || 'main', data.agentType || 'claude-code');

      return mapRow<Workspace>(db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id) as Record<string, unknown>);
    },
  );

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_LIST, (_event, projectId: string) => {
    const db = getDb();
    return mapRows<Workspace>(
      db.prepare('SELECT * FROM workspaces WHERE project_id = ? ORDER BY created_at DESC').all(projectId) as Record<string, unknown>[],
    );
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_GET, (_event, id: string) => {
    const db = getDb();
    const row = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id);
    return row ? mapRow<Workspace>(row as Record<string, unknown>) : null;
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_DELETE, async (_event, id: string) => {
    const db = getDb();
    const row = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id) as Record<string, unknown> | undefined;

    if (row?.worktree_path) {
      // Look up the project to get the repo path for worktree removal
      const projectRow = db.prepare('SELECT * FROM projects WHERE id = ?').get(row.project_id as string) as Record<string, unknown> | undefined;
      if (projectRow) {
        try {
          await removeWorktree(projectRow.path as string, row.worktree_path as string);
        } catch (err) {
          logger.warn(`Failed to remove worktree during workspace delete: ${err}`);
        }
      }
    }

    db.prepare('DELETE FROM workspaces WHERE id = ?').run(id);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_ARCHIVE, (_event, id: string) => {
    const db = getDb();
    db.prepare("UPDATE workspaces SET status = 'archived' WHERE id = ?").run(id);
    return mapRow<Workspace>(db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id) as Record<string, unknown>);
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_RESTORE, (_event, id: string) => {
    const db = getDb();
    db.prepare("UPDATE workspaces SET status = 'active' WHERE id = ?").run(id);
    return mapRow<Workspace>(db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id) as Record<string, unknown>);
  });
}
