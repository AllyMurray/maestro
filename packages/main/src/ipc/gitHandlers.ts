import { IpcMain } from 'electron';
import { IPC_CHANNELS } from '@maestro/shared';
import { getGitStatus, getDiff, getDiffFiles } from '../services/gitStatusManager';

export function registerGitHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IPC_CHANNELS.GIT_STATUS, async (_event, workspacePath: string) => {
    return getGitStatus(workspacePath);
  });

  ipcMain.handle(
    IPC_CHANNELS.GIT_DIFF,
    async (_event, data: { workspacePath: string; filePath?: string; staged?: boolean }) => {
      return getDiff(data.workspacePath, data.filePath, data.staged);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.GIT_DIFF_FILES,
    async (_event, data: { workspacePath: string; base?: string }) => {
      return getDiffFiles(data.workspacePath, data.base);
    },
  );
}
