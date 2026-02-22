import { IpcMain } from 'electron';
import { IPC_CHANNELS } from '@maestro/shared';
import { registerConfigHandlers } from './configHandlers';
import { registerProjectHandlers } from './projectHandlers';
import { registerWorkspaceHandlers } from './workspaceHandlers';

export function registerAllIpcHandlers(ipcMain: IpcMain): void {
  registerConfigHandlers(ipcMain);
  registerProjectHandlers(ipcMain);
  registerWorkspaceHandlers(ipcMain);
}
