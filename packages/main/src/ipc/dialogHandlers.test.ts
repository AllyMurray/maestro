import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IPC_CHANNELS } from '@maestro/shared';

const showOpenDialog = vi.fn();
const fromWebContents = vi.fn();

vi.mock('electron', async (orig) => {
  const actual = await orig<typeof import('electron')>();
  return {
    ...actual,
    dialog: {
      showOpenDialog: (...args: unknown[]) => showOpenDialog(...args),
    },
    BrowserWindow: {
      fromWebContents: (...args: unknown[]) => fromWebContents(...args),
    },
  };
});

describe('dialogHandlers', () => {
  let handlers: Record<string, (...args: any[]) => any>;

  beforeEach(async () => {
    handlers = {};
    vi.clearAllMocks();
    fromWebContents.mockReturnValue({ id: 1 });

    const mockIpcMain = {
      handle: vi.fn((channel: string, handler: any) => {
        handlers[channel] = handler;
      }),
    };

    const { registerDialogHandlers } = await import('./dialogHandlers');
    registerDialogHandlers(mockIpcMain as any);
  });

  it('returns selected directory path', async () => {
    showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/tmp/repo'] });

    const result = await handlers[IPC_CHANNELS.DIALOG_SELECT_DIRECTORY]({ sender: { id: 1 } });

    expect(result).toBe('/tmp/repo');
    expect(showOpenDialog).toHaveBeenCalled();
  });

  it('returns null when selection is cancelled', async () => {
    showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });

    const result = await handlers[IPC_CHANNELS.DIALOG_SELECT_DIRECTORY]({ sender: { id: 1 } });
    expect(result).toBeNull();
  });
});
