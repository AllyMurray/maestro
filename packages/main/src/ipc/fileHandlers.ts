import { IpcMain } from 'electron';
import { IPC_CHANNELS } from '@maestro/shared';
import type { FileEntry } from '@maestro/shared';
import * as fs from 'fs';
import * as path from 'path';

const IGNORED = new Set(['.git', 'node_modules', '.DS_Store', '.next', '__pycache__', '.cache']);

export function registerFileHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    IPC_CHANNELS.FILE_LIST_DIR,
    async (_event, data: { dirPath: string; depth?: number }) => {
      const { dirPath, depth = 1 } = data;

      if (!fs.existsSync(dirPath)) {
        throw new Error(`Directory not found: ${dirPath}`);
      }

      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      const result: FileEntry[] = [];

      for (const entry of entries) {
        if (IGNORED.has(entry.name)) continue;

        result.push({
          name: entry.name,
          path: path.join(dirPath, entry.name),
          isDirectory: entry.isDirectory(),
        });
      }

      result.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      return result;
    },
  );
}
