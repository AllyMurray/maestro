import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '../__test-utils__/render';
import { PRView } from './PRView';
import { IPC_CHANNELS } from '@maestro/shared';

vi.mock('./ChecksPanel', () => ({
  ChecksPanel: ({ prRef }: { prRef: string }) => <div>Checks for {prRef}</div>,
}));

describe('PRView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window.maestro.invoke as any).mockImplementation((channel: string) => {
      if (channel === IPC_CHANNELS.PR_GET) {
        return Promise.resolve({
          id: '101',
          number: 101,
          title: 'Add feature',
          body: 'PR body',
          state: 'open',
          baseBranch: 'main',
          headBranch: 'feat/a',
          mergeable: true,
        });
      }
      if (channel === IPC_CHANNELS.PR_LIST_COMMENTS) {
        return Promise.resolve([
          {
            id: 'c1',
            author: 'ally',
            body: 'Looks good',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ]);
      }
      if (channel === IPC_CHANNELS.PR_MERGE) {
        return Promise.resolve({ success: true });
      }
      return Promise.resolve(null);
    });
  });

  it('loads PR details and comments', async () => {
    renderWithProviders(<PRView repoPath="/tmp/repo" platform="github" prId="101" />);

    expect(await screen.findByText('Add feature')).toBeInTheDocument();
    expect(screen.getByText('Checks for 101')).toBeInTheDocument();
    expect(screen.getByText('Comments (1)')).toBeInTheDocument();
    expect(screen.getByText('Looks good')).toBeInTheDocument();
  });

  it('merges PR using selected strategy', async () => {
    renderWithProviders(<PRView repoPath="/tmp/repo" platform="github" prId="101" />);

    await screen.findByText('Add feature');
    await userEvent.click(screen.getByRole('button', { name: 'Merge PR' }));

    await waitFor(() => {
      expect(window.maestro.invoke).toHaveBeenCalledWith(IPC_CHANNELS.PR_MERGE, {
        repoPath: '/tmp/repo',
        platform: 'github',
        prId: '101',
        strategy: 'squash',
      });
    });
  });
});
