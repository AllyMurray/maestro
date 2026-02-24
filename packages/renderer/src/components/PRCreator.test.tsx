import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '../__test-utils__/render';
import { PRCreator } from './PRCreator';
import { IPC_CHANNELS } from '@maestro/shared';

describe('PRCreator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window.maestro.invoke as any).mockResolvedValue({
      number: '101',
      url: 'https://example/pr/101',
    });
  });

  it('creates PR and calls onCreated/onClose', async () => {
    const onClose = vi.fn();
    const onCreated = vi.fn();
    renderWithProviders(
      <PRCreator
        opened
        onClose={onClose}
        workspaceId="w1"
        repoPath="/tmp/repo"
        platform="github"
        headBranch="feat/a"
        targetBranch="main"
        onCreated={onCreated}
      />,
    );

    await userEvent.type(screen.getByPlaceholderText('Pull Request title'), 'Add feature');
    await userEvent.type(
      screen.getByPlaceholderText('Describe your changes...'),
      'Implement the feature',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Create Pull Request' }));

    await waitFor(() => {
      expect(window.maestro.invoke).toHaveBeenCalledWith(IPC_CHANNELS.PR_CREATE, {
        workspaceId: 'w1',
        repoPath: '/tmp/repo',
        platform: 'github',
        opts: {
          title: 'Add feature',
          body: 'Implement the feature',
          baseBranch: 'main',
          headBranch: 'feat/a',
          draft: false,
        },
      });
    });

    expect(onCreated).toHaveBeenCalledWith({ number: '101', url: 'https://example/pr/101' });
    expect(onClose).toHaveBeenCalled();
  });
});
