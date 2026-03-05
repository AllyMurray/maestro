import { IpcMain } from 'electron';
import { IPC_CHANNELS } from '@maestro/shared';
import {
  getSession,
  listSessions,
  getMessages,
  clearSessionHistory,
} from '../services/sessionManager';

export function registerSessionHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IPC_CHANNELS.SESSION_GET, (_event, id: string) => {
    return getSession(id);
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_LIST, (_event, workspaceId: string) => {
    return listSessions(workspaceId);
  });

  ipcMain.handle(
    IPC_CHANNELS.MESSAGE_LIST,
    (_event, sessionId: string, limit?: number, offset?: number) => {
      return getMessages(sessionId, limit, offset);
    },
  );

  ipcMain.handle(IPC_CHANNELS.SESSION_CLEAR, (_event, sessionId: string) => {
    clearSessionHistory(sessionId);
    return { success: true };
  });
}
