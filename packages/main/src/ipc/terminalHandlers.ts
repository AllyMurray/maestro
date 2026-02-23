import { IpcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '@maestro/shared';
import {
  createTerminal,
  writeToTerminal,
  resizeTerminal,
  closeTerminal,
} from '../services/terminalSessionManager';

export function registerTerminalHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    IPC_CHANNELS.TERMINAL_CREATE,
    (event, data: { workspacePath: string; cols?: number; rows?: number }) => {
      const window = BrowserWindow.fromWebContents(event.sender);

      const { id } = createTerminal(
        data.workspacePath,
        data.cols,
        data.rows,
        (output: string) => {
          window?.webContents.send(IPC_CHANNELS.TERMINAL_DATA, {
            terminalId: id,
            data: output,
          });
        },
        () => {
          window?.webContents.send(IPC_CHANNELS.TERMINAL_DATA, {
            terminalId: id,
            data: '\r\n[Process exited]\r\n',
          });
        },
      );

      return { id };
    },
  );

  ipcMain.on(IPC_CHANNELS.TERMINAL_WRITE, (_event, data: { terminalId: string; data: string }) => {
    writeToTerminal(data.terminalId, data.data);
  });

  ipcMain.on(
    IPC_CHANNELS.TERMINAL_RESIZE,
    (_event, data: { terminalId: string; cols: number; rows: number }) => {
      resizeTerminal(data.terminalId, data.cols, data.rows);
    },
  );

  ipcMain.handle(IPC_CHANNELS.TERMINAL_CLOSE, (_event, terminalId: string) => {
    closeTerminal(terminalId);
    return { success: true };
  });
}
