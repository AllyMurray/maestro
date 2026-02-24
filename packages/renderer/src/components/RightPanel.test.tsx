import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '../__test-utils__/render';
import { useAppStore } from '../stores/appStore';
import { RightPanel } from './RightPanel';
import { IPC_CHANNELS } from '@maestro/shared';

vi.mock('./FileBrowser', () => ({
  FileBrowser: ({ workspacePath }: { workspacePath: string }) => <div>Files: {workspacePath}</div>,
}));

vi.mock('./DiffViewer', () => ({
  DiffViewer: ({ workspacePath }: { workspacePath: string }) => <div>Diff: {workspacePath}</div>,
}));

vi.mock('./TerminalPanel', () => ({
  TerminalPanel: ({ workspacePath }: { workspacePath: string }) => (
    <div>Terminal: {workspacePath}</div>
  ),
}));

vi.mock('./ChecksPanel', () => ({
  ChecksPanel: ({ prRef }: { prRef: string }) => <div>Checks: {prRef}</div>,
}));

describe('RightPanel', () => {
  const workspace = {
    id: 'w1',
    projectId: 'p1',
    name: 'WS',
    branchName: 'feat/test',
    worktreePath: '/tmp/worktree',
    agentType: 'claude-code',
    status: 'in_progress',
    prNumber: '123',
    prUrl: 'https://example/pr/123',
    targetBranch: 'main',
    createdAt: '',
  } as any;

  const project = {
    id: 'p1',
    name: 'Project',
    path: '/tmp/repo',
    gitPlatform: 'github',
    defaultBranch: 'main',
    settingsJson: '{}',
    createdAt: '',
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ rightPanelTab: 'changes' } as any);
    (window.maestro.invoke as any).mockImplementation((channel: string) => {
      if (channel === IPC_CHANNELS.GIT_DIFF_FILES) {
        return Promise.resolve([{ path: 'a.ts' }, { path: 'b.ts' }]);
      }
      return Promise.resolve(null);
    });
  });

  it('loads change count and renders checks tab when PR exists', async () => {
    renderWithProviders(<RightPanel workspace={workspace} project={project} />);

    await waitFor(() => {
      expect(window.maestro.invoke).toHaveBeenCalledWith(IPC_CHANNELS.GIT_DIFF_FILES, {
        workspacePath: '/tmp/worktree',
      });
    });

    expect(screen.getByRole('tab', { name: /Changes/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'All files' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Checks' })).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows missing worktree message when path is null', async () => {
    const noPath = { ...workspace, worktreePath: null, prNumber: null };
    const noPlatform = { ...project, gitPlatform: null };

    renderWithProviders(<RightPanel workspace={noPath} project={noPlatform} />);

    await userEvent.click(screen.getByRole('tab', { name: 'All files' }));
    expect(screen.getAllByText('No worktree path').length).toBeGreaterThan(0);
    expect(screen.queryByRole('tab', { name: 'Checks' })).not.toBeInTheDocument();
  });
});
