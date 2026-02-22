import { IpcMain } from 'electron';
import { IPC_CHANNELS, CreatePROptions, MergeStrategy, GitPlatform } from '@maestro/shared';
import { createGitPlatform } from '../services/git-platforms';
import { getDb } from '../database/db';
import { logger } from '../services/logger';

export function registerPRHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    IPC_CHANNELS.PR_CREATE,
    async (
      _event,
      data: {
        workspaceId: string;
        repoPath: string;
        platform: GitPlatform;
        opts: CreatePROptions;
      },
    ) => {
      const gitPlatform = createGitPlatform(data.platform);
      const result = await gitPlatform.createPR(data.repoPath, data.opts);

      // Update workspace with PR info
      const db = getDb();
      db.prepare('UPDATE workspaces SET pr_number = ?, pr_url = ? WHERE id = ?').run(
        result.number,
        result.url,
        data.workspaceId,
      );

      logger.info(`PR created for workspace ${data.workspaceId}: ${result.url}`);
      return result;
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.PR_GET,
    async (_event, data: { repoPath: string; platform: GitPlatform; prId: string }) => {
      const gitPlatform = createGitPlatform(data.platform);
      return gitPlatform.getPR(data.repoPath, data.prId);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.PR_MERGE,
    async (
      _event,
      data: { repoPath: string; platform: GitPlatform; prId: string; strategy: MergeStrategy },
    ) => {
      const gitPlatform = createGitPlatform(data.platform);
      await gitPlatform.mergePR(data.repoPath, data.prId, data.strategy);
      return { success: true };
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.PR_LIST_COMMENTS,
    async (_event, data: { repoPath: string; platform: GitPlatform; prId: string }) => {
      const gitPlatform = createGitPlatform(data.platform);
      return gitPlatform.listComments(data.repoPath, data.prId);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.PR_GET_CHECKS,
    async (_event, data: { repoPath: string; platform: GitPlatform; ref: string }) => {
      const gitPlatform = createGitPlatform(data.platform);
      return gitPlatform.getChecks(data.repoPath, data.ref);
    },
  );
}
