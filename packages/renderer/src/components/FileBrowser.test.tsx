import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '../__test-utils__/render';
import { FileBrowser } from './FileBrowser';
import { IPC_CHANNELS } from '@maestro/shared';

describe('FileBrowser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders root entries and expands directory children', async () => {
    (window.maestro.invoke as any).mockImplementation(
      (channel: string, payload: { dirPath: string }) => {
        if (channel !== IPC_CHANNELS.FILE_LIST_DIR) return Promise.resolve([]);
        if (payload.dirPath === '/tmp/ws') {
          return Promise.resolve([
            { name: 'src', path: '/tmp/ws/src', isDirectory: true },
            { name: 'README.md', path: '/tmp/ws/README.md', isDirectory: false },
          ]);
        }
        if (payload.dirPath === '/tmp/ws/src') {
          return Promise.resolve([
            { name: 'index.ts', path: '/tmp/ws/src/index.ts', isDirectory: false },
          ]);
        }
        return Promise.resolve([]);
      },
    );

    renderWithProviders(<FileBrowser workspacePath="/tmp/ws" />);

    expect(await screen.findByText('src')).toBeInTheDocument();
    expect(screen.getByText('README.md')).toBeInTheDocument();

    await userEvent.click(screen.getByText('src'));
    expect(await screen.findByText('index.ts')).toBeInTheDocument();
  });

  it('shows empty state when directory has no entries', async () => {
    (window.maestro.invoke as any).mockResolvedValue([]);
    renderWithProviders(<FileBrowser workspacePath="/tmp/empty" />);

    await waitFor(() => {
      expect(screen.getByText('Empty directory')).toBeInTheDocument();
    });
  });
});
