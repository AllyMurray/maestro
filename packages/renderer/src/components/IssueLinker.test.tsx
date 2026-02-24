import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '../__test-utils__/render';
import { IssueLinker } from './IssueLinker';
import { IPC_CHANNELS } from '@maestro/shared';

describe('IssueLinker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window.maestro.invoke as any).mockImplementation((channel: string) => {
      if (channel === IPC_CHANNELS.ISSUE_SEARCH) {
        return Promise.resolve([
          {
            id: '42',
            number: 42,
            title: 'Fix bug',
            url: 'https://example/issues/42',
            labels: ['bug', 'p1'],
          },
        ]);
      }
      if (channel === IPC_CHANNELS.ISSUE_LINK) {
        return Promise.resolve({ success: true });
      }
      return Promise.resolve(null);
    });
  });

  it('searches issues and links selected issue', async () => {
    const onClose = vi.fn();
    renderWithProviders(
      <IssueLinker
        opened
        onClose={onClose}
        workspaceId="w1"
        repoPath="/tmp/repo"
        platform="github"
      />,
    );

    await userEvent.type(screen.getByPlaceholderText('Search issues...'), 'bug');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText('Fix bug')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Fix bug'));

    await waitFor(() => {
      expect(window.maestro.invoke).toHaveBeenCalledWith(IPC_CHANNELS.ISSUE_LINK, {
        workspaceId: 'w1',
        source: 'github',
        issueId: '42',
        title: 'Fix bug',
        url: 'https://example/issues/42',
      });
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
