import { IpcMain } from 'electron';
import { IPC_CHANNELS } from '@maestro/shared';
import { getDb } from '../database/db';

export function registerDiffCommentHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    IPC_CHANNELS.DIFF_COMMENT_CREATE,
    (
      _event,
      data: {
        workspaceId: string;
        filePath: string;
        lineNumber: number;
        body: string;
      },
    ) => {
      const db = getDb();
      const result = db
        .prepare(
          `INSERT INTO diff_comments (workspace_id, file_path, line_number, body)
           VALUES (?, ?, ?, ?)`,
        )
        .run(data.workspaceId, data.filePath, data.lineNumber, data.body);
      return { id: result.lastInsertRowid };
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.DIFF_COMMENT_LIST,
    (_event, data: { workspaceId: string; filePath?: string }) => {
      const db = getDb();
      if (data.filePath) {
        return db
          .prepare(
            'SELECT * FROM diff_comments WHERE workspace_id = ? AND file_path = ? ORDER BY line_number',
          )
          .all(data.workspaceId, data.filePath);
      }
      return db
        .prepare('SELECT * FROM diff_comments WHERE workspace_id = ? ORDER BY file_path, line_number')
        .all(data.workspaceId);
    },
  );

  ipcMain.handle(IPC_CHANNELS.DIFF_COMMENT_RESOLVE, (_event, commentId: number) => {
    const db = getDb();
    db.prepare('UPDATE diff_comments SET is_resolved = 1 WHERE id = ?').run(commentId);
    return { success: true };
  });
}
