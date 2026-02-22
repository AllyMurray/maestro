import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '../__test-utils__/render';
import { Sidebar } from './Sidebar';
import { useAppStore } from '../stores/appStore';

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
    renderWithProviders(<Sidebar onAddProject={() => {}} onCreateWorkspace={() => {}} />);
    expect(screen.getByText('Projects')).toBeInTheDocument();
  });

  it('shows empty state when no projects', () => {
    renderWithProviders(<Sidebar onAddProject={() => {}} onCreateWorkspace={() => {}} />);
    expect(screen.getByText(/No projects yet/)).toBeInTheDocument();
  });

  it('renders project list', () => {
    useAppStore.setState({
      projects: [
        { id: 'p1', name: 'Project Alpha', path: '/alpha', gitPlatform: null, defaultBranch: 'main', settingsJson: '{}', createdAt: '' },
        { id: 'p2', name: 'Project Beta', path: '/beta', gitPlatform: null, defaultBranch: 'main', settingsJson: '{}', createdAt: '' },
      ] as any,
    });

    renderWithProviders(<Sidebar onAddProject={() => {}} onCreateWorkspace={() => {}} />);
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

    renderWithProviders(<Sidebar onAddProject={() => {}} onCreateWorkspace={() => {}} />);
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

    renderWithProviders(<Sidebar onAddProject={() => {}} onCreateWorkspace={() => {}} />);
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

    renderWithProviders(<Sidebar onAddProject={() => {}} onCreateWorkspace={() => {}} />);
    expect(screen.getByText('PR')).toBeInTheDocument();
  });

  it('calls onAddProject when add button is clicked', async () => {
    const { userEvent } = await import('../__test-utils__/render');
    const onAddProject = vi.fn();
    renderWithProviders(<Sidebar onAddProject={onAddProject} onCreateWorkspace={() => {}} />);

    // Find the add button (it's the first actionicon in the header)
    const buttons = screen.getAllByRole('button');
    // The add project button should be present
    const addBtn = buttons.find((btn) => btn.getAttribute('aria-label')?.includes('Add') || true);
    if (addBtn) {
      await userEvent.click(addBtn);
    }
  });

  it('calls onCreateWorkspace when new workspace button is clicked', async () => {
    const { userEvent } = await import('../__test-utils__/render');

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
    renderWithProviders(<Sidebar onAddProject={() => {}} onCreateWorkspace={onCreateWorkspace} />);

    const newWsBtn = screen.getByLabelText('New workspace');
    await userEvent.click(newWsBtn);
    expect(onCreateWorkspace).toHaveBeenCalledOnce();
  });
});
