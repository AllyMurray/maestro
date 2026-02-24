import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '../__test-utils__/render';
import { ChecksPanel } from './ChecksPanel';
import { IPC_CHANNELS } from '@maestro/shared';

describe('ChecksPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading then renders checks and aggregate status', async () => {
    (window.maestro.invoke as any).mockResolvedValue([
      { name: 'build', status: 'completed', conclusion: 'success', url: 'https://example/build' },
      { name: 'tests', status: 'completed', conclusion: 'failure', url: 'https://example/tests' },
    ]);

    renderWithProviders(<ChecksPanel repoPath="/tmp/repo" platform="github" prRef="123" />);

    expect(screen.getByText('Loading checks...')).toBeInTheDocument();

    expect(await screen.findByText('build')).toBeInTheDocument();
    expect(screen.getByText('tests')).toBeInTheDocument();
    expect(screen.getByText('1 failed')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Details' }).length).toBe(2);
  });

  it('refresh button re-fetches checks', async () => {
    (window.maestro.invoke as any).mockResolvedValue([]);
    renderWithProviders(<ChecksPanel repoPath="/tmp/repo" platform="github" prRef="123" />);

    await waitFor(() => {
      expect(window.maestro.invoke).toHaveBeenCalledWith(IPC_CHANNELS.PR_GET_CHECKS, {
        repoPath: '/tmp/repo',
        platform: 'github',
        ref: '123',
      });
    });

    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect((window.maestro.invoke as any).mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
