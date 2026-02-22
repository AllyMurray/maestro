import { IpcMain } from 'electron';
import { IPC_CHANNELS } from '@maestro/shared';
import {
  createCheckpoint,
  listCheckpoints,
  revertToCheckpoint,
} from '../services/checkpointManager';

export function registerCheckpointHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    IPC_CHANNELS.CHECKPOINT_CREATE,
    async (
      _event,
      data: {
        workspacePath: string;
        workspaceId: string;
        sessionId: string;
        messageIndex?: number;
      },
    ) => {
      return createCheckpoint(
        data.workspacePath,
        data.workspaceId,
        data.sessionId,
        data.messageIndex,
      );
    },
  );

  ipcMain.handle(IPC_CHANNELS.CHECKPOINT_LIST, (_event, workspaceId: string) => {
    return listCheckpoints(workspaceId);
  });

  ipcMain.handle(
    IPC_CHANNELS.CHECKPOINT_REVERT,
    async (_event, data: { workspacePath: string; checkpointId: number }) => {
      await revertToCheckpoint(data.workspacePath, data.checkpointId);
      return { success: true };
    },
  );
}
