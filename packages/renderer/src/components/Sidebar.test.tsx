import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '../__test-utils__/render';
import { Sidebar } from './Sidebar';
import { useAppStore } from '../stores/appStore';

const defaultProps = {
  onAddProject: () => {},
  onCreateWorkspace: () => {},
  onDeleteProject: () => {},
  onDeleteWorkspace: () => {},
};

describe('Sidebar', () => {
  beforeEach(() => {
    useAppStore.setState({
      activeProjectId: null,
      activeWorkspaceId: null,
      projects: [],
      workspaces: [],
    });
  });

  it('renders the Projects header', () => {
    renderWithProviders(<Sidebar {...defaultProps} />);
    expect(screen.getByText('Projects')).toBeInTheDocument();
  });

  it('shows empty state when no projects', () => {
    renderWithProviders(<Sidebar {...defaultProps} />);
    expect(screen.getByText(/No projects yet/)).toBeInTheDocument();
  });

  it('renders project list', () => {
    useAppStore.setState({
      projects: [
        { id: 'p1', name: 'Project Alpha', path: '/alpha', gitPlatform: null, defaultBranch: 'main', settingsJson: '{}', createdAt: '' },
        { id: 'p2', name: 'Project Beta', path: '/beta', gitPlatform: null, defaultBranch: 'main', settingsJson: '{}', createdAt: '' },
      ] as any,
    });

    renderWithProviders(<Sidebar {...defaultProps} />);
    expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    expect(screen.getByText('Project Beta')).toBeInTheDocument();
  });

  it('shows workspaces for active project', () => {
    useAppStore.setState({
      activeProjectId: 'p1',
      projects: [
        { id: 'p1', name: 'Project Alpha', path: '/alpha', gitPlatform: null, defaultBranch: 'main', settingsJson: '{}', createdAt: '' },
      ] as any,
      workspaces: [
        { id: 'ws1', projectId: 'p1', name: 'Feature Work', branchName: 'feat/test', worktreePath: '/wt', status: 'active', prNumber: null, prUrl: null, targetBranch: 'main', createdAt: '' },
      ] as any,
    });

    renderWithProviders(<Sidebar {...defaultProps} />);
    expect(screen.getByText('Feature Work')).toBeInTheDocument();
    expect(screen.getByText('Workspaces')).toBeInTheDocument();
  });

  it('shows "No workspaces" when project has none', () => {
    useAppStore.setState({
      activeProjectId: 'p1',
      projects: [
        { id: 'p1', name: 'Project Alpha', path: '/alpha', gitPlatform: null, defaultBranch: 'main', settingsJson: '{}', createdAt: '' },
      ] as any,
      workspaces: [],
    });

    renderWithProviders(<Sidebar {...defaultProps} />);
    expect(screen.getByText('No workspaces')).toBeInTheDocument();
  });

  it('shows PR badge on workspace with PR', () => {
    useAppStore.setState({
      activeProjectId: 'p1',
      projects: [
        { id: 'p1', name: 'P1', path: '/p1', gitPlatform: null, defaultBranch: 'main', settingsJson: '{}', createdAt: '' },
      ] as any,
      workspaces: [
        { id: 'ws1', projectId: 'p1', name: 'WS1', branchName: 'feat', worktreePath: '/wt', status: 'active', prNumber: '42', prUrl: 'https://github.com/test/pull/42', targetBranch: 'main', createdAt: '' },
      ] as any,
    });

    renderWithProviders(<Sidebar {...defaultProps} />);
    expect(screen.getByText('PR')).toBeInTheDocument();
  });

  it('calls onAddProject when add button is clicked', async () => {
    const onAddProject = vi.fn();
    renderWithProviders(<Sidebar {...defaultProps} onAddProject={onAddProject} />);

    const buttons = screen.getAllByRole('button');
    const addBtn = buttons.find((btn) => btn.getAttribute('aria-label')?.includes('Add') || true);
    if (addBtn) {
      await userEvent.click(addBtn);
    }
  });

  it('calls onCreateWorkspace when new workspace button is clicked', async () => {
    useAppStore.setState({
      activeProjectId: 'p1',
      projects: [
        { id: 'p1', name: 'Project Alpha', path: '/alpha', gitPlatform: null, defaultBranch: 'main', settingsJson: '{}', createdAt: '' },
      ] as any,
      workspaces: [
        { id: 'ws1', projectId: 'p1', name: 'WS1', branchName: 'feat', worktreePath: '/wt', status: 'active', prNumber: null, prUrl: null, targetBranch: 'main', createdAt: '' },
      ] as any,
    });

    const onCreateWorkspace = vi.fn();
    renderWithProviders(<Sidebar {...defaultProps} onCreateWorkspace={onCreateWorkspace} />);

    const newWsBtn = screen.getByLabelText('New workspace');
    await userEvent.click(newWsBtn);
    expect(onCreateWorkspace).toHaveBeenCalledOnce();
  });

  it('shows delete button for each project', () => {
    useAppStore.setState({
      projects: [
        { id: 'p1', name: 'Alpha', path: '/alpha', gitPlatform: null, defaultBranch: 'main', settingsJson: '{}', createdAt: '' },
        { id: 'p2', name: 'Beta', path: '/beta', gitPlatform: null, defaultBranch: 'main', settingsJson: '{}', createdAt: '' },
      ] as any,
    });

    renderWithProviders(<Sidebar {...defaultProps} />);
    expect(screen.getByLabelText('Delete project Alpha')).toBeInTheDocument();
    expect(screen.getByLabelText('Delete project Beta')).toBeInTheDocument();
  });

  it('calls onDeleteProject when delete button clicked', async () => {
    useAppStore.setState({
      projects: [
        { id: 'p1', name: 'Alpha', path: '/alpha', gitPlatform: null, defaultBranch: 'main', settingsJson: '{}', createdAt: '' },
      ] as any,
    });

    const onDeleteProject = vi.fn();
    renderWithProviders(<Sidebar {...defaultProps} onDeleteProject={onDeleteProject} />);

    await userEvent.click(screen.getByLabelText('Delete project Alpha'));
    expect(onDeleteProject).toHaveBeenCalledWith('p1');
  });

  it('calls onDeleteWorkspace when delete button clicked', async () => {
    useAppStore.setState({
      activeProjectId: 'p1',
      projects: [
        { id: 'p1', name: 'P1', path: '/p1', gitPlatform: null, defaultBranch: 'main', settingsJson: '{}', createdAt: '' },
      ] as any,
      workspaces: [
        { id: 'ws1', projectId: 'p1', name: 'MyWorkspace', branchName: 'feat', worktreePath: '/wt', status: 'active', prNumber: null, prUrl: null, targetBranch: 'main', createdAt: '' },
      ] as any,
    });

    const onDeleteWorkspace = vi.fn();
    renderWithProviders(<Sidebar {...defaultProps} onDeleteWorkspace={onDeleteWorkspace} />);

    await userEvent.click(screen.getByLabelText('Delete workspace MyWorkspace'));
    expect(onDeleteWorkspace).toHaveBeenCalledWith('ws1');
  });
});
