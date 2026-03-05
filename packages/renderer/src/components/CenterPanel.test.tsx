import { describe, it, expect, vi, beforeEach } from 'vitest';
import { notifications } from '@mantine/notifications';
import { renderWithProviders, screen, userEvent, waitFor } from '../__test-utils__/render';
import { CenterPanel } from './CenterPanel';
import { IPC_CHANNELS } from '@maestro/shared';

vi.mock('@mantine/notifications', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mantine/notifications')>();
  return {
    ...actual,
    notifications: {
      show: vi.fn(),
    },
  };
});

vi.mock('./ChatPanel', () => ({
  ChatPanel: ({
    onSend,
    onStop,
  }: {
    onSend: (text: string) => Promise<void> | void;
    onStop?: () => void;
  }) => (
    <div>
      <button
        onClick={async () => {
          try {
            await onSend('Test prompt');
          } catch {
            // swallowed for test assertions
          }
        }}
      >
        Mock Send
      </button>
      <button onClick={() => onStop?.()}>Mock Stop</button>
    </div>
  ),
}));

vi.mock('./WorkspaceHeaderMenu', () => ({
  WorkspaceHeaderMenu: ({
    onClearHistory,
    onChangeStatus,
    onDelete,
  }: {
    onClearHistory: () => void;
    onChangeStatus: () => void;
    onDelete: () => void;
  }) => (
    <div>
      <button onClick={onClearHistory}>Clear Chat History</button>
      <button onClick={onChangeStatus}>Open Status Picker</button>
      <button onClick={onDelete}>Delete Workspace</button>
    </div>
  ),
}));

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
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    (window.maestro.invoke as any).mockImplementation((channel: string) => {
      if (channel === IPC_CHANNELS.TODO_LIST) {
        return Promise.resolve([]);
      }
      if (channel === IPC_CHANNELS.CHECKPOINT_LIST) {
        return Promise.resolve([]);
      }
      if (channel === IPC_CHANNELS.SESSION_LIST) {
        return Promise.resolve([]);
      }
      if (channel === IPC_CHANNELS.AGENT_STATUS) {
        return Promise.resolve('idle');
      }
      return Promise.resolve(null);
    });
  });

  it('restores latest workspace session on mount', async () => {
    (window.maestro.invoke as any).mockImplementation((channel: string) => {
      if (channel === IPC_CHANNELS.TODO_LIST) return Promise.resolve([]);
      if (channel === IPC_CHANNELS.CHECKPOINT_LIST) return Promise.resolve([]);
      if (channel === IPC_CHANNELS.SESSION_LIST)
        return Promise.resolve([{ id: 's2' }, { id: 's1' }]);
      if (channel === IPC_CHANNELS.AGENT_STATUS) return Promise.resolve('waiting');
      if (channel === IPC_CHANNELS.AGENT_SEND) return Promise.resolve({ success: true });
      if (channel === IPC_CHANNELS.AGENT_STOP) return Promise.resolve({ success: true });
      return Promise.resolve(null);
    });

    renderWithProviders(
      <CenterPanel
        workspace={workspace as any}
        project={project as any}
        onDeleteWorkspace={() => {}}
      />,
    );

    await waitFor(() => {
      expect(window.maestro.invoke).toHaveBeenCalledWith(IPC_CHANNELS.SESSION_LIST, 'ws1');
      expect(window.maestro.invoke).toHaveBeenCalledWith(IPC_CHANNELS.AGENT_STATUS, 's2');
    });

    await userEvent.click(screen.getByRole('button', { name: 'Mock Send' }));
    expect(window.maestro.invoke).not.toHaveBeenCalledWith(
      IPC_CHANNELS.AGENT_START,
      expect.anything(),
    );
    expect(window.maestro.invoke).toHaveBeenCalledWith(IPC_CHANNELS.AGENT_SEND, {
      sessionId: 's2',
      prompt: 'Test prompt',
    });

    await userEvent.click(screen.getByRole('button', { name: 'Mock Stop' }));
    expect(window.maestro.invoke).toHaveBeenCalledWith(IPC_CHANNELS.AGENT_STOP, 's2');
  });

  it('restores latest session for each selected workspace', async () => {
    const secondWorkspace = {
      ...workspace,
      id: 'ws2',
      name: 'Workspace Two',
      branchName: 'feat/other',
    };

    (window.maestro.invoke as any).mockImplementation((channel: string, ...args: unknown[]) => {
      if (channel === IPC_CHANNELS.TODO_LIST) return Promise.resolve([]);
      if (channel === IPC_CHANNELS.CHECKPOINT_LIST) return Promise.resolve([]);
      if (channel === IPC_CHANNELS.SESSION_LIST) {
        return Promise.resolve(args[0] === 'ws1' ? [{ id: 's-ws1' }] : [{ id: 's-ws2' }]);
      }
      if (channel === IPC_CHANNELS.AGENT_STATUS) return Promise.resolve('idle');
      return Promise.resolve(null);
    });

    const { rerender } = renderWithProviders(
      <CenterPanel
        workspace={workspace as any}
        project={project as any}
        onDeleteWorkspace={() => {}}
      />,
    );

    await waitFor(() => {
      expect(window.maestro.invoke).toHaveBeenCalledWith(IPC_CHANNELS.AGENT_STATUS, 's-ws1');
    });

    rerender(
      <CenterPanel
        workspace={secondWorkspace as any}
        project={project as any}
        onDeleteWorkspace={() => {}}
      />,
    );

    await waitFor(() => {
      expect(window.maestro.invoke).toHaveBeenCalledWith(IPC_CHANNELS.SESSION_LIST, 'ws2');
      expect(window.maestro.invoke).toHaveBeenCalledWith(IPC_CHANNELS.AGENT_STATUS, 's-ws2');
    });
  });

  it('starts, sends, and stops agent from chat actions', async () => {
    (window.maestro.invoke as any).mockImplementation((channel: string, ...args: unknown[]) => {
      if (channel === IPC_CHANNELS.TODO_LIST) return Promise.resolve([]);
      if (channel === IPC_CHANNELS.CHECKPOINT_LIST) return Promise.resolve([]);
      if (channel === IPC_CHANNELS.AGENT_START) return Promise.resolve({ sessionId: 's1' });
      if (channel === IPC_CHANNELS.AGENT_SEND) return Promise.resolve({ success: true });
      if (channel === IPC_CHANNELS.AGENT_STOP) return Promise.resolve({ success: true });
      return Promise.resolve(null);
    });

    renderWithProviders(
      <CenterPanel
        workspace={workspace as any}
        project={project as any}
        onDeleteWorkspace={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Mock Send' }));
    await waitFor(() => {
      expect(window.maestro.invoke).toHaveBeenCalledWith(IPC_CHANNELS.AGENT_START, {
        workspaceId: 'ws1',
        workspacePath: '/tmp/worktree',
        agentType: 'claude-code',
        opts: {},
      });
    });
    expect(window.maestro.invoke).toHaveBeenCalledWith(IPC_CHANNELS.AGENT_SEND, {
      sessionId: 's1',
      prompt: 'Test prompt',
    });

    await userEvent.click(screen.getByRole('button', { name: 'Mock Stop' }));
    expect(window.maestro.invoke).toHaveBeenCalledWith(IPC_CHANNELS.AGENT_STOP, 's1');
  });

  it('shows notification when workspace path is missing', async () => {
    renderWithProviders(
      <CenterPanel
        workspace={{ ...workspace, worktreePath: null } as any}
        project={project as any}
        onDeleteWorkspace={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Mock Send' }));
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Workspace not ready', color: 'red' }),
    );
  });

  it('shows notification when agent start fails', async () => {
    (window.maestro.invoke as any).mockImplementation((channel: string) => {
      if (channel === IPC_CHANNELS.TODO_LIST) return Promise.resolve([]);
      if (channel === IPC_CHANNELS.CHECKPOINT_LIST) return Promise.resolve([]);
      if (channel === IPC_CHANNELS.AGENT_START) return Promise.reject(new Error('start failed'));
      return Promise.resolve(null);
    });

    renderWithProviders(
      <CenterPanel
        workspace={workspace as any}
        project={project as any}
        onDeleteWorkspace={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Mock Send' }));
    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Agent error', message: 'start failed', color: 'red' }),
      );
    });
  });

  it('updates workspace status from status picker', async () => {
    renderWithProviders(
      <CenterPanel
        workspace={workspace as any}
        project={project as any}
        onDeleteWorkspace={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Open Status Picker' }));
    const statusInput = screen.getAllByLabelText('Change workspace status')[0];
    await userEvent.click(statusInput);
    await userEvent.click(screen.getByRole('option', { name: 'done' }));

    await waitFor(() => {
      expect(window.maestro.invoke).toHaveBeenCalledWith(IPC_CHANNELS.WORKSPACE_UPDATE_STATUS, {
        id: 'ws1',
        status: 'done',
      });
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

  it('clears current session chat history', async () => {
    (window.maestro.invoke as any).mockImplementation((channel: string) => {
      if (channel === IPC_CHANNELS.TODO_LIST) return Promise.resolve([]);
      if (channel === IPC_CHANNELS.CHECKPOINT_LIST) return Promise.resolve([]);
      if (channel === IPC_CHANNELS.SESSION_LIST) return Promise.resolve([{ id: 's1' }]);
      if (channel === IPC_CHANNELS.AGENT_STATUS) return Promise.resolve('idle');
      if (channel === IPC_CHANNELS.SESSION_CLEAR) return Promise.resolve({ success: true });
      return Promise.resolve(null);
    });

    renderWithProviders(
      <CenterPanel
        workspace={workspace as any}
        project={project as any}
        onDeleteWorkspace={() => {}}
      />,
    );

    await waitFor(() => {
      expect(window.maestro.invoke).toHaveBeenCalledWith(IPC_CHANNELS.SESSION_LIST, 'ws1');
    });

    await userEvent.click(screen.getByRole('button', { name: 'Clear Chat History' }));

    expect(window.confirm).toHaveBeenCalledWith('Clear chat history for this session?');
    await waitFor(() => {
      expect(window.maestro.invoke).toHaveBeenCalledWith(IPC_CHANNELS.SESSION_CLEAR, 's1');
    });
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Chat history cleared', color: 'green' }),
    );
  });
});
