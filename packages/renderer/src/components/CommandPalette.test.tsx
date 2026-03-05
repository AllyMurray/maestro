import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '../__test-utils__/render';
import { useAppStore } from '../stores/appStore';
import { CommandPalette } from './CommandPalette';

vi.mock('@mantine/spotlight', () => ({
  Spotlight: ({
    actions,
  }: {
    actions: Array<{ id: string; label: string; onClick?: () => void }>;
  }) => (
    <div>
      {actions.map((action) => (
        <button key={action.id} onClick={action.onClick}>
          {action.label}
        </button>
      ))}
    </div>
  ),
}));

describe('CommandPalette', () => {
  beforeEach(() => {
    useAppStore.setState({
      activeProjectId: null,
      activeWorkspaceId: null,
      activeSessionId: null,
      rightPanelTab: 'changes',
      rightPanelOpen: true,
      projects: [
        {
          id: 'p1',
          name: 'Project One',
          path: '/tmp/p1',
          gitPlatform: null,
          defaultBranch: 'main',
          settingsJson: '{}',
          createdAt: '',
        },
      ] as any,
      workspaces: [
        {
          id: 'w1',
          projectId: 'p1',
          name: 'Workspace One',
          branchName: 'feat/one',
          worktreePath: '/tmp/w1',
          agentType: 'claude-code',
          status: 'in_progress',
          prNumber: null,
          prUrl: null,
          targetBranch: 'main',
          createdAt: '',
        },
        {
          id: 'w2',
          projectId: 'p1',
          name: 'Cancelled WS',
          branchName: 'feat/cancelled',
          worktreePath: '/tmp/w2',
          agentType: 'claude-code',
          status: 'cancelled',
          prNumber: null,
          prUrl: null,
          targetBranch: 'main',
          createdAt: '',
        },
      ] as any,
    });
  });

  it('includes project/workspace actions and excludes cancelled workspaces', () => {
    renderWithProviders(
      <CommandPalette
        onToggleSidebar={vi.fn()}
        onToggleRightPanel={vi.fn()}
        onOpenSettings={vi.fn()}
        onCreateWorkspace={vi.fn()}
        onClearChatHistory={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Project One' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Workspace One' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelled WS' })).not.toBeInTheDocument();
  });

  it('executes dynamic action callbacks', async () => {
    const onToggleSidebar = vi.fn();

    renderWithProviders(
      <CommandPalette
        onToggleSidebar={onToggleSidebar}
        onToggleRightPanel={vi.fn()}
        onOpenSettings={vi.fn()}
        onCreateWorkspace={vi.fn()}
        onClearChatHistory={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Toggle Sidebar' }));
    expect(onToggleSidebar).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: 'Project One' }));
    expect(useAppStore.getState().activeProjectId).toBe('p1');

    await userEvent.click(screen.getByRole('button', { name: 'Workspace One' }));
    expect(useAppStore.getState().activeWorkspaceId).toBe('w1');
  });

  it('runs clear history action when workspace is active', async () => {
    useAppStore.setState({ activeWorkspaceId: 'w1' });
    const onClearChatHistory = vi.fn();

    renderWithProviders(
      <CommandPalette
        onToggleSidebar={vi.fn()}
        onToggleRightPanel={vi.fn()}
        onOpenSettings={vi.fn()}
        onCreateWorkspace={vi.fn()}
        onClearChatHistory={onClearChatHistory}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Clear Chat History' }));
    expect(onClearChatHistory).toHaveBeenCalledTimes(1);
  });
});
