import { IpcMain } from 'electron';
import { registerConfigHandlers } from './configHandlers';
import { registerProjectHandlers } from './projectHandlers';
import { registerWorkspaceHandlers } from './workspaceHandlers';
import { registerAgentHandlers } from './agentHandlers';
import { registerSessionHandlers } from './sessionHandlers';

export function registerAllIpcHandlers(ipcMain: IpcMain): void {
  registerConfigHandlers(ipcMain);
  registerProjectHandlers(ipcMain);
  registerWorkspaceHandlers(ipcMain);
  registerAgentHandlers(ipcMain);
  registerSessionHandlers(ipcMain);
}
