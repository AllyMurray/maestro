import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '../__test-utils__/render';
import { CenterPanel } from './CenterPanel';
import { IPC_CHANNELS } from '@maestro/shared';

const workspace = {
  id: 'ws1',
  projectId: 'p1',
  name: 'Workspace One',
  branchName: 'feat/ui',
  worktreePath: '/tmp/worktree',
  agentType: 'claude-code',
  status: 'in_progress',
  prNumber: null,
  prUrl: null,
  targetBranch: 'main',
  createdAt: '2026-01-01T00:00:00.000Z',
} as const;

const project = {
  id: 'p1',
  name: 'Project One',
  path: '/tmp/repo',
  gitPlatform: 'github',
  defaultBranch: 'main',
  settingsJson: '{}',
  createdAt: '2026-01-01T00:00:00.000Z',
} as const;

describe('CenterPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window.maestro.invoke as any).mockImplementation((channel: string) => {
      if (channel === IPC_CHANNELS.TODO_LIST) {
        return Promise.resolve([]);
      }
      if (channel === IPC_CHANNELS.CHECKPOINT_LIST) {
        return Promise.resolve([]);
      }
      return Promise.resolve(null);
    });
  });

  it('renders always-visible header actions for todos and checkpoints', async () => {
    renderWithProviders(
      <CenterPanel
        workspace={workspace as any}
        project={project as any}
        onDeleteWorkspace={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: 'Open todos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open checkpoints' })).toBeInTheDocument();

    await waitFor(() => {
      expect(window.maestro.invoke).toHaveBeenCalledWith(IPC_CHANNELS.TODO_LIST, 'ws1');
      expect(window.maestro.invoke).toHaveBeenCalledWith(IPC_CHANNELS.CHECKPOINT_LIST, 'ws1');
    });
  });

  it('opens todos and checkpoints drawers from header actions', async () => {
    renderWithProviders(
      <CenterPanel
        workspace={workspace as any}
        project={project as any}
        onDeleteWorkspace={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Open todos' }));
    expect(await screen.findByPlaceholderText('Add a todo...')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Open checkpoints' }));
    expect(
      await screen.findByText(
        'No checkpoints yet. Checkpoints are created before each agent turn.',
      ),
    ).toBeInTheDocument();
  });
});
