import { IpcMain } from 'electron';
import { IPC_CHANNELS, Project } from '@maestro/shared';
import { getDb } from '../database/db';
import { mapRow, mapRows } from '../database/mapRow';
import { v4 as uuid } from 'uuid';
import { execSync } from 'child_process';
import { detectGitPlatform } from '../services/git-platforms/GitPlatformFactory';

function getDefaultBranch(repoPath: string): string {
  try {
    const result = execSync('git symbolic-ref refs/remotes/origin/HEAD', {
      cwd: repoPath,
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();
    return result.replace('refs/remotes/origin/', '');
  } catch {
    return 'main';
  }
}

export function registerProjectHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    IPC_CHANNELS.PROJECT_CREATE,
    async (_event, data: { name: string; path: string; gitPlatform?: string; defaultBranch?: string }) => {
      let gitPlatform = data.gitPlatform || null;
      let defaultBranch = data.defaultBranch || getDefaultBranch(data.path);

      if (!gitPlatform) {
        const detected = await detectGitPlatform(data.path);
        if (detected) gitPlatform = detected.platform;
      }

      const db = getDb();
      const id = uuid();
      db.prepare(
        `INSERT INTO projects (id, name, path, git_platform, default_branch)
       VALUES (?, ?, ?, ?, ?)`,
      ).run(id, data.name, data.path, gitPlatform, defaultBranch);

      return mapRow<Project>(db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Record<string, unknown>);
    },
  );

  ipcMain.handle(IPC_CHANNELS.PROJECT_LIST, () => {
    const db = getDb();
    return mapRows<Project>(db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all() as Record<string, unknown>[]);
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_GET, (_event, id: string) => {
    const db = getDb();
    const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    return row ? mapRow<Project>(row as Record<string, unknown>) : null;
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

      const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
      return row ? mapRow<Project>(row as Record<string, unknown>) : null;
    },
  );
}
