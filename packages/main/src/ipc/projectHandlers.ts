import { IpcMain } from 'electron';
import { IPC_CHANNELS, Project } from '@maestro/shared';
import { getDb } from '../database/db';
import { v4 as uuid } from 'uuid';

export function registerProjectHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    IPC_CHANNELS.PROJECT_CREATE,
    (_event, data: { name: string; path: string; gitPlatform?: string; defaultBranch?: string }) => {
      const db = getDb();
      const id = uuid();
      db.prepare(
        `INSERT INTO projects (id, name, path, git_platform, default_branch)
       VALUES (?, ?, ?, ?, ?)`,
      ).run(id, data.name, data.path, data.gitPlatform || null, data.defaultBranch || 'main');

      return db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project;
    },
  );

  ipcMain.handle(IPC_CHANNELS.PROJECT_LIST, () => {
    const db = getDb();
    return db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_GET, (_event, id: string) => {
    const db = getDb();
    return db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_DELETE, (_event, id: string) => {
    const db = getDb();
    db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    return { success: true };
  });

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_UPDATE,
    (_event, id: string, data: Partial<Pick<Project, 'name' | 'defaultBranch' | 'settingsJson'>>) => {
      const db = getDb();
      const sets: string[] = [];
      const values: unknown[] = [];

      if (data.name !== undefined) {
        sets.push('name = ?');
        values.push(data.name);
      }
      if (data.defaultBranch !== undefined) {
        sets.push('default_branch = ?');
        values.push(data.defaultBranch);
      }
      if (data.settingsJson !== undefined) {
        sets.push('settings_json = ?');
        values.push(data.settingsJson);
      }

      if (sets.length > 0) {
        values.push(id);
        db.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`).run(...values);
      }

      return db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    },
  );
}
