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

  it('renders the Maestro header', () => {
    renderWithProviders(<Sidebar {...defaultProps} />);
    expect(screen.getByText('Maestro')).toBeInTheDocument();
  });

  it('shows empty state when no projects', () => {
    renderWithProviders(<Sidebar {...defaultProps} />);
    expect(screen.getByText(/No projects yet/)).toBeInTheDocument();
  });

  it('renders project name when single project selected', () => {
    useAppStore.setState({
      activeProjectId: 'p1',
      projects: [
        { id: 'p1', name: 'Project Alpha', path: '/alpha', gitPlatform: null, defaultBranch: 'main', settingsJson: '{}', createdAt: '' },
      ] as any,
    });

    renderWithProviders(<Sidebar {...defaultProps} />);
    expect(screen.getByText('Project Alpha')).toBeInTheDocument();
  });

  it('shows workspaces grouped by status', () => {
    useAppStore.setState({
      activeProjectId: 'p1',
      projects: [
        { id: 'p1', name: 'Project Alpha', path: '/alpha', gitPlatform: null, defaultBranch: 'main', settingsJson: '{}', createdAt: '' },
      ] as any,
      workspaces: [
        { id: 'ws1', projectId: 'p1', name: 'Feature Work', branchName: 'feat/test', worktreePath: '/wt', agentType: 'claude-code', status: 'in_progress', prNumber: null, prUrl: null, targetBranch: 'main', createdAt: '' },
      ] as any,
    });

    renderWithProviders(<Sidebar {...defaultProps} />);
    expect(screen.getByText('Feature Work')).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
  });

  it('shows "No workspaces" in empty status groups', () => {
    useAppStore.setState({
      activeProjectId: 'p1',
      projects: [
        { id: 'p1', name: 'Project Alpha', path: '/alpha', gitPlatform: null, defaultBranch: 'main', settingsJson: '{}', createdAt: '' },
      ] as any,
      workspaces: [],
    });

    renderWithProviders(<Sidebar {...defaultProps} />);
    expect(screen.getAllByText('No workspaces').length).toBeGreaterThan(0);
  });

  it('shows PR badge on workspace with PR', () => {
    useAppStore.setState({
      activeProjectId: 'p1',
      projects: [
        { id: 'p1', name: 'P1', path: '/p1', gitPlatform: null, defaultBranch: 'main', settingsJson: '{}', createdAt: '' },
      ] as any,
      workspaces: [
        { id: 'ws1', projectId: 'p1', name: 'WS1', branchName: 'feat', worktreePath: '/wt', agentType: 'claude-code', status: 'in_progress', prNumber: '42', prUrl: 'https://github.com/test/pull/42', targetBranch: 'main', createdAt: '' },
      ] as any,
    });

    renderWithProviders(<Sidebar {...defaultProps} />);
    expect(screen.getByText('PR')).toBeInTheDocument();
  });

  it('renders Add repository button', () => {
    renderWithProviders(<Sidebar {...defaultProps} />);
    expect(screen.getByText('Add repository')).toBeInTheDocument();
  });

  it('renders New workspace button when project is active', () => {
    useAppStore.setState({
      activeProjectId: 'p1',
      projects: [
        { id: 'p1', name: 'P1', path: '/p1', gitPlatform: null, defaultBranch: 'main', settingsJson: '{}', createdAt: '' },
      ] as any,
    });

    renderWithProviders(<Sidebar {...defaultProps} />);
    expect(screen.getByText('New workspace')).toBeInTheDocument();
  });
});
