import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IPC_CHANNELS } from '@maestro/shared';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('fileHandlers', () => {
  let handlers: Record<string, (...args: any[]) => any>;
  let tmpDir: string;

  beforeEach(async () => {
    handlers = {};
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-file-handlers-'));

    const mockIpcMain = {
      handle: (channel: string, handler: any) => {
        handlers[channel] = handler;
      },
    };

    const { registerFileHandlers } = await import('./fileHandlers');
    registerFileHandlers(mockIpcMain as any);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('lists directory entries sorted and ignores system folders', async () => {
    fs.mkdirSync(path.join(tmpDir, '.git'));
    fs.mkdirSync(path.join(tmpDir, 'src'));
    fs.mkdirSync(path.join(tmpDir, 'docs'));
    fs.writeFileSync(path.join(tmpDir, 'b.txt'), 'b');
    fs.writeFileSync(path.join(tmpDir, 'a.txt'), 'a');

    const result = await handlers[IPC_CHANNELS.FILE_LIST_DIR](null, { dirPath: tmpDir });
    const names = result.map((r: { name: string }) => r.name);

    expect(names).toEqual(['docs', 'src', 'a.txt', 'b.txt']);
  });

  it('throws when directory does not exist', async () => {
    await expect(
      handlers[IPC_CHANNELS.FILE_LIST_DIR](null, { dirPath: path.join(tmpDir, 'missing') }),
    ).rejects.toThrow('Directory not found');
  });
});
