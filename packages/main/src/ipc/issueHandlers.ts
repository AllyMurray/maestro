import { IpcMain } from 'electron';
import { IPC_CHANNELS, GitPlatform } from '@maestro/shared';
import { createGitPlatform } from '../services/git-platforms';
import { getDb } from '../database/db';

export function registerIssueHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    IPC_CHANNELS.ISSUE_SEARCH,
    async (_event, data: { repoPath: string; platform: GitPlatform; query: string }) => {
      const gitPlatform = createGitPlatform(data.platform);
      return gitPlatform.searchIssues(data.repoPath, data.query);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.ISSUE_LINK,
    (
      _event,
      data: {
        workspaceId: string;
        source: GitPlatform;
        issueId: string;
        title?: string;
        url?: string;
      },
    ) => {
      const db = getDb();
      db.prepare(
        `INSERT INTO linked_issues (workspace_id, source, issue_id, title, url)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(data.workspaceId, data.source, data.issueId, data.title || null, data.url || null);
      return { success: true };
    },
  );

  ipcMain.handle(IPC_CHANNELS.ISSUE_UNLINK, (_event, id: number) => {
    const db = getDb();
    db.prepare('DELETE FROM linked_issues WHERE id = ?').run(id);
    return { success: true };
  });
}
