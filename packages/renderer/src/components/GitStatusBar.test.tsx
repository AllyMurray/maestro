import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '../__test-utils__/render';
import { GitStatusBar } from './GitStatusBar';
import { IPC_CHANNELS } from '@maestro/shared';

describe('GitStatusBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders branch and status badges from git status payload', async () => {
    (window.maestro.invoke as any).mockResolvedValue({
      branch: 'feat/a',
      ahead: 2,
      behind: 1,
      hasConflicts: true,
      files: [
        { path: 'a.ts', status: 'modified' },
        { path: 'b.ts', status: 'added' },
        { path: 'c.ts', status: 'untracked' },
        { path: 'd.ts', status: 'deleted' },
      ],
    });

    renderWithProviders(<GitStatusBar workspacePath="/tmp/ws" />);

    expect(await screen.findByText('feat/a')).toBeInTheDocument();
    expect(screen.getByText('↑2')).toBeInTheDocument();
    expect(screen.getByText('↓1')).toBeInTheDocument();
    expect(screen.getByText('~1')).toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
    expect(screen.getByText('-1')).toBeInTheDocument();
    expect(screen.getByText('Conflicts')).toBeInTheDocument();
    expect(window.maestro.invoke).toHaveBeenCalledWith(IPC_CHANNELS.GIT_STATUS, '/tmp/ws');
  });
});
