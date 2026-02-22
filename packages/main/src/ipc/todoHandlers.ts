import { IpcMain } from 'electron';
import { IPC_CHANNELS } from '@maestro/shared';
import { getDb } from '../database/db';

export function registerTodoHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    IPC_CHANNELS.TODO_CREATE,
    (_event, data: { workspaceId: string; title: string; blocksMerge?: boolean }) => {
      const db = getDb();
      const result = db
        .prepare(
          `INSERT INTO todos (workspace_id, title, blocks_merge)
           VALUES (?, ?, ?)`,
        )
        .run(data.workspaceId, data.title, data.blocksMerge !== false ? 1 : 0);
      return { id: result.lastInsertRowid };
    },
  );

  ipcMain.handle(IPC_CHANNELS.TODO_LIST, (_event, workspaceId: string) => {
    const db = getDb();
    return db
      .prepare('SELECT * FROM todos WHERE workspace_id = ? ORDER BY created_at ASC')
      .all(workspaceId);
  });

  ipcMain.handle(
    IPC_CHANNELS.TODO_UPDATE,
    (_event, data: { id: number; isCompleted?: boolean; title?: string; blocksMerge?: boolean }) => {
      const db = getDb();
      const sets: string[] = [];
      const values: unknown[] = [];

      if (data.isCompleted !== undefined) {
        sets.push('is_completed = ?');
        values.push(data.isCompleted ? 1 : 0);
      }
      if (data.title !== undefined) {
        sets.push('title = ?');
        values.push(data.title);
      }
      if (data.blocksMerge !== undefined) {
        sets.push('blocks_merge = ?');
        values.push(data.blocksMerge ? 1 : 0);
      }

      if (sets.length > 0) {
        values.push(data.id);
        db.prepare(`UPDATE todos SET ${sets.join(', ')} WHERE id = ?`).run(...values);
      }
      return { success: true };
    },
  );

  ipcMain.handle(IPC_CHANNELS.TODO_DELETE, (_event, id: number) => {
    const db = getDb();
    db.prepare('DELETE FROM todos WHERE id = ?').run(id);
    return { success: true };
  });
}
