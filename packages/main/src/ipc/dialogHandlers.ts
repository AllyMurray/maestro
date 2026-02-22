import { IpcMain, dialog, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '@maestro/shared';

export function registerDialogHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IPC_CHANNELS.DIALOG_SELECT_DIRECTORY, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory'],
      title: 'Select a Git Repository',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });
}
