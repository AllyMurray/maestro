import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '../__test-utils__/render';
import { WorkspaceView } from './WorkspaceView';
import { useAppStore } from '../stores/appStore';
import type { Project, Workspace } from '@maestro/shared';

// Mock heavy child components to keep tests focused
vi.mock('./TerminalPanel', () => ({ TerminalPanel: () => <div>TerminalPanel</div> }));
vi.mock('./DiffViewer', () => ({ DiffViewer: () => <div>DiffViewer</div> }));
vi.mock('./CheckpointTimeline', () => ({ CheckpointTimeline: () => <div>CheckpointTimeline</div> }));
vi.mock('./TodoList', () => ({ TodoList: () => <div>TodoList</div> }));
vi.mock('./GitStatusBar', () => ({ GitStatusBar: () => <div>GitStatusBar</div> }));
vi.mock('./PRView', () => ({ PRView: () => <div>PRView</div> }));
vi.mock('./PRCreator', () => ({ PRCreator: () => <div>PRCreator</div> }));
vi.mock('./IssueLinker', () => ({ IssueLinker: () => <div>IssueLinker</div> }));

const mockProject: Project = {
  id: 'p1',
  name: 'Test Project',
  path: '/test/project',
  gitPlatform: 'github',
  defaultBranch: 'main',
  settingsJson: '{}',
  createdAt: '2024-01-01T00:00:00Z',
};

const mockWorkspace: Workspace = {
  id: 'ws1',
  projectId: 'p1',
  name: 'Feature Work',
  branchName: 'feat/test',
  worktreePath: '/test/worktree',
  status: 'active',
  prNumber: null,
  prUrl: null,
  targetBranch: 'main',
  createdAt: '2024-01-01T00:00:00Z',
};

const mockWorkspaceWithPR: Workspace = {
  ...mockWorkspace,
  prNumber: '42',
  prUrl: 'https://github.com/test/pull/42',
};

describe('WorkspaceView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window.maestro.invoke as any).mockResolvedValue(null);
    (window.maestro.on as any).mockReturnValue(() => {});
    useAppStore.setState({ activeWorkspaceTab: 'chat' });
  });

  it('renders workspace name and branch', () => {
    renderWithProviders(<WorkspaceView workspace={mockWorkspace} project={mockProject} />);
    expect(screen.getByText('Feature Work')).toBeInTheDocument();
    expect(screen.getByText('feat/test')).toBeInTheDocument();
  });

  it('renders PR tab with Create PR label when no PR exists', () => {
    renderWithProviders(<WorkspaceView workspace={mockWorkspace} project={mockProject} />);
    expect(screen.getByText('Create PR')).toBeInTheDocument();
  });

  it('renders PR tab with PR label when workspace has PR', () => {
    renderWithProviders(<WorkspaceView workspace={mockWorkspaceWithPR} project={mockProject} />);
    // The tab should say "PR" not "Create PR"
    expect(screen.getByRole('tab', { name: 'PR' })).toBeInTheDocument();
  });

  it('shows Create Pull Request button in PR tab when no PR', () => {
    useAppStore.setState({ activeWorkspaceTab: 'pr' });
    renderWithProviders(<WorkspaceView workspace={mockWorkspace} project={mockProject} />);
    expect(screen.getByText('No pull request yet')).toBeInTheDocument();
    expect(screen.getByText('Create Pull Request')).toBeInTheDocument();
  });

  it('shows link issue button when project has git platform', () => {
    renderWithProviders(<WorkspaceView workspace={mockWorkspace} project={mockProject} />);
    expect(screen.getByLabelText('Link issue')).toBeInTheDocument();
  });

  it('hides link issue button when no git platform', () => {
    const projectNoGit = { ...mockProject, gitPlatform: null as any };
    renderWithProviders(<WorkspaceView workspace={mockWorkspace} project={projectNoGit} />);
    expect(screen.queryByLabelText('Link issue')).not.toBeInTheDocument();
  });

  it('shows no git platform message in PR tab when no platform', () => {
    useAppStore.setState({ activeWorkspaceTab: 'pr' });
    const projectNoGit = { ...mockProject, gitPlatform: null as any };
    renderWithProviders(<WorkspaceView workspace={mockWorkspace} project={projectNoGit} />);
    expect(screen.getByText('No git platform detected')).toBeInTheDocument();
  });
});
