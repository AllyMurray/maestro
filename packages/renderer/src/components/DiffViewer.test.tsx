import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '../__test-utils__/render';
import { DiffViewer } from './DiffViewer';
import { IPC_CHANNELS } from '@maestro/shared';

describe('DiffViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads changed files and renders diff content', async () => {
    (window.maestro.invoke as any).mockImplementation((channel: string) => {
      if (channel === IPC_CHANNELS.GIT_DIFF_FILES) {
        return Promise.resolve([
          { path: 'src/app.ts', status: 'modified', additions: 2, deletions: 1 },
        ]);
      }
      if (channel === IPC_CHANNELS.GIT_DIFF) {
        return Promise.resolve('diff --git a/src/app.ts b/src/app.ts\n+new line\n-old line');
      }
      return Promise.resolve('');
    });

    renderWithProviders(<DiffViewer workspacePath="/tmp/ws" />);

    expect(await screen.findByText('app.ts')).toBeInTheDocument();
    expect(await screen.findByText('+new line')).toBeInTheDocument();
    expect(screen.getByText('-old line')).toBeInTheDocument();
  });

  it('shows empty prompt when no file is selected', async () => {
    (window.maestro.invoke as any).mockResolvedValue([]);
    renderWithProviders(<DiffViewer workspacePath="/tmp/ws" />);

    expect(await screen.findByText('Select a file to view diff')).toBeInTheDocument();
  });
});
