import { IpcMain } from 'electron';
import { IPC_CHANNELS } from '@maestro/shared';
import { getConfig, setConfig, getAllConfig } from '../services/configManager';

export function registerConfigHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IPC_CHANNELS.CONFIG_GET, (_event, key: string) => {
    return getConfig(key);
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_SET, (_event, key: string, value: string) => {
    setConfig(key, value);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_GET_ALL, () => {
    return getAllConfig();
  });
}
