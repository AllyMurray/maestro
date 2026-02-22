import { IpcMain } from 'electron';
import { registerConfigHandlers } from './configHandlers';
import { registerProjectHandlers } from './projectHandlers';
import { registerWorkspaceHandlers } from './workspaceHandlers';
import { registerAgentHandlers } from './agentHandlers';
import { registerSessionHandlers } from './sessionHandlers';
import { registerTerminalHandlers } from './terminalHandlers';
import { registerGitHandlers } from './gitHandlers';
import { registerPRHandlers } from './prHandlers';
import { registerIssueHandlers } from './issueHandlers';
import { registerCheckpointHandlers } from './checkpointHandlers';
import { registerDiffCommentHandlers } from './diffCommentHandlers';
import { registerTodoHandlers } from './todoHandlers';

export function registerAllIpcHandlers(ipcMain: IpcMain): void {
  registerConfigHandlers(ipcMain);
  registerProjectHandlers(ipcMain);
  registerWorkspaceHandlers(ipcMain);
  registerAgentHandlers(ipcMain);
  registerSessionHandlers(ipcMain);
  registerTerminalHandlers(ipcMain);
  registerGitHandlers(ipcMain);
  registerPRHandlers(ipcMain);
  registerIssueHandlers(ipcMain);
  registerCheckpointHandlers(ipcMain);
  registerDiffCommentHandlers(ipcMain);
  registerTodoHandlers(ipcMain);
}
