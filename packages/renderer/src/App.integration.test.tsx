import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderWithProviders, waitFor } from './__test-utils__/render';
import App from './App';
import { IPC_CHANNELS } from '@maestro/shared';
import { useAppStore } from './stores/appStore';

vi.mock('./components/ThreeColumnLayout', () => ({
  ThreeColumnLayout: ({ center }: { center: unknown }) => <div>{center as any}</div>,
}));

vi.mock('./components/Sidebar', () => ({
  Sidebar: () => null,
}));

vi.mock('./components/WelcomeView', () => ({
  WelcomeView: () => <div>Welcome</div>,
}));

vi.mock('./components/CenterPanel', () => ({
  CenterPanel: () => <div>Center</div>,
}));

vi.mock('./components/RightPanel', () => ({
  RightPanel: () => null,
}));

vi.mock('./components/CommandPalette', () => ({
  CommandPalette: () => null,
}));

vi.mock('./components/SettingsDialog', () => ({
  SettingsDialog: () => null,
}));

vi.mock('./components/WorkspaceCreator', () => ({
  WorkspaceCreator: () => null,
}));

vi.mock('./hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: () => {},
}));

vi.mock('@mantine/notifications', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mantine/notifications')>();
  return {
    ...actual,
    notifications: {
      show: vi.fn(),
    },
  };
});

describe('App workspace selection restore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      activeProjectId: null,
      activeWorkspaceId: null,
      activeSessionId: null,
      rightPanelTab: 'changes',
      rightPanelOpen: true,
      projects: [],
      workspaces: [],
    });

    (window.maestro.invoke as any).mockImplementation((channel: string, ...args: unknown[]) => {
      if (channel === IPC_CHANNELS.PROJECT_LIST) {
        return Promise.resolve([
          {
            id: 'p1',
            name: 'Repo One',
            path: '/repo-1',
            gitPlatform: null,
            defaultBranch: 'main',
            settingsJson: '{}',
            createdAt: '',
          },
          {
            id: 'p2',
            name: 'Repo Two',
            path: '/repo-2',
            gitPlatform: null,
            defaultBranch: 'main',
            settingsJson: '{}',
            createdAt: '',
          },
        ]);
      }

      if (channel === IPC_CHANNELS.CONFIG_GET) {
        const [key] = args;
        if (key === 'last_active_project_id') {
          return Promise.resolve('p2');
        }
        if (key === 'last_active_workspace_id:p2') {
          return Promise.resolve('w22');
        }
        if (key === 'last_active_workspace_id:p1') {
          return Promise.resolve('w11');
        }
        return Promise.resolve(null);
      }

      if (channel === IPC_CHANNELS.WORKSPACE_LIST) {
        const [projectId] = args;
        if (projectId === 'p2') {
          return Promise.resolve([
            {
              id: 'w21',
              projectId: 'p2',
              name: 'Workspace 2-1',
              branchName: 'feat/a',
              worktreePath: '/wt/21',
              agentType: 'claude-code',
              status: 'in_progress',
              prNumber: null,
              prUrl: null,
              targetBranch: 'main',
              createdAt: '',
            },
            {
              id: 'w22',
              projectId: 'p2',
              name: 'Workspace 2-2',
              branchName: 'feat/b',
              worktreePath: '/wt/22',
              agentType: 'claude-code',
              status: 'in_progress',
              prNumber: null,
              prUrl: null,
              targetBranch: 'main',
              createdAt: '',
            },
          ]);
        }
        if (projectId === 'p1') {
          return Promise.resolve([
            {
              id: 'w11',
              projectId: 'p1',
              name: 'Workspace 1-1',
              branchName: 'feat/c',
              worktreePath: '/wt/11',
              agentType: 'claude-code',
              status: 'in_progress',
              prNumber: null,
              prUrl: null,
              targetBranch: 'main',
              createdAt: '',
            },
          ]);
        }
      }

      if (channel === IPC_CHANNELS.CONFIG_SET) {
        return Promise.resolve(null);
      }

      return Promise.resolve(null);
    });
  });

  it('restores saved project and workspace, then restores workspace when switching project', async () => {
    renderWithProviders(<App />);

    await waitFor(() => {
      expect(useAppStore.getState().activeProjectId).toBe('p2');
      expect(useAppStore.getState().activeWorkspaceId).toBe('w22');
    });

    act(() => {
      useAppStore.getState().setActiveProject('p1');
    });

    await waitFor(() => {
      expect(useAppStore.getState().activeProjectId).toBe('p1');
      expect(useAppStore.getState().activeWorkspaceId).toBe('w11');
    });

    expect(window.maestro.invoke).toHaveBeenCalledWith(
      IPC_CHANNELS.CONFIG_SET,
      'last_active_workspace_id:p2',
      'w22',
    );
    expect(window.maestro.invoke).toHaveBeenCalledWith(
      IPC_CHANNELS.CONFIG_SET,
      'last_active_workspace_id:p1',
      'w11',
    );
  });
});
