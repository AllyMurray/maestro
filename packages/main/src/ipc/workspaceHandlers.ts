import { IpcMain } from 'electron';
import { IPC_CHANNELS } from '@maestro/shared';
import { getDb } from '../database/db';
import { v4 as uuid } from 'uuid';

export function registerWorkspaceHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_CREATE,
    (
      _event,
      data: {
        projectId: string;
        name: string;
        branchName: string;
        targetBranch?: string;
      },
    ) => {
      const db = getDb();
      const id = uuid();
      db.prepare(
        `INSERT INTO workspaces (id, project_id, name, branch_name, target_branch)
       VALUES (?, ?, ?, ?, ?)`,
      ).run(id, data.projectId, data.name, data.branchName, data.targetBranch || 'main');

      return db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id);
    },
  );

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_LIST, (_event, projectId: string) => {
    const db = getDb();
    return db
      .prepare('SELECT * FROM workspaces WHERE project_id = ? ORDER BY created_at DESC')
      .all(projectId);
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_GET, (_event, id: string) => {
    const db = getDb();
    return db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id);
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_DELETE, (_event, id: string) => {
    const db = getDb();
    db.prepare('DELETE FROM workspaces WHERE id = ?').run(id);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_ARCHIVE, (_event, id: string) => {
    const db = getDb();
    db.prepare("UPDATE workspaces SET status = 'archived' WHERE id = ?").run(id);
    return db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id);
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_RESTORE, (_event, id: string) => {
    const db = getDb();
    db.prepare("UPDATE workspaces SET status = 'active' WHERE id = ?").run(id);
    return db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id);
  });
}
