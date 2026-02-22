import { useCallback, useEffect, useState } from 'react';
import { AppShell, Text, Group, Box, ActionIcon, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { spotlight } from '@mantine/spotlight';
import { notifications } from '@mantine/notifications';
import { IconSettings, IconLayoutSidebar, IconPlus } from './components/Icons';
import { Sidebar } from './components/Sidebar';
import { WelcomeView } from './components/WelcomeView';
import { WorkspaceView } from './components/WorkspaceView';
import { CommandPalette } from './components/CommandPalette';
import { SettingsDialog } from './components/SettingsDialog';
import { WorkspaceCreator } from './components/WorkspaceCreator';
import { useAppStore } from './stores/appStore';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { ipc } from './services/ipc';
import { IPC_CHANNELS } from '@maestro/shared';
import type { Project, Workspace, AgentType } from '@maestro/shared';

export default function App() {
  const [sidebarOpen, { toggle: toggleSidebar }] = useDisclosure(true);
  const [settingsOpen, { open: openSettings, close: closeSettings }] = useDisclosure(false);
  const [wsCreatorOpen, { open: openWsCreator, close: closeWsCreator }] = useDisclosure(false);
  const [zenMode, setZenMode] = useState(false);

  const activeWorkspaceId = useAppStore((s) => s.activeWorkspaceId);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const workspaces = useAppStore((s) => s.workspaces);
  const projects = useAppStore((s) => s.projects);
  const setProjects = useAppStore((s) => s.setProjects);
  const setWorkspaces = useAppStore((s) => s.setWorkspaces);
  const addWorkspace = useAppStore((s) => s.addWorkspace);
  const setActiveWorkspace = useAppStore((s) => s.setActiveWorkspace);

  const addProject = useAppStore((s) => s.addProject);
  const setActiveProject = useAppStore((s) => s.setActiveProject);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || null;
  const activeProject = projects.find((p) => p.id === activeProjectId) || null;

  const handleAddProject = useCallback(async () => {
    try {
      const dirPath = await ipc.invoke<string | null>(IPC_CHANNELS.DIALOG_SELECT_DIRECTORY);
      if (!dirPath) return;

      const name = dirPath.split('/').pop() || dirPath;
      const project = await ipc.invoke<Project>(IPC_CHANNELS.PROJECT_CREATE, {
        name,
        path: dirPath,
      });
      addProject(project);
      setActiveProject(project.id);
      notifications.show({
        title: 'Project added',
        message: name,
        color: 'green',
      });
    } catch (err) {
      notifications.show({
        title: 'Failed to add project',
        message: String(err),
        color: 'red',
      });
    }
  }, [addProject, setActiveProject]);

  // Load projects on startup
  useEffect(() => {
    ipc.invoke<Project[]>(IPC_CHANNELS.PROJECT_LIST).then(setProjects).catch(() => {});
  }, [setProjects]);

  // Load workspaces when project changes
  useEffect(() => {
    if (!activeProjectId) return;
    ipc
      .invoke<Workspace[]>(IPC_CHANNELS.WORKSPACE_LIST, activeProjectId)
      .then(setWorkspaces)
      .catch(() => {});
  }, [activeProjectId, setWorkspaces]);

  const handleCreateWorkspace = useCallback(
    async (data: {
      name: string;
      branchName: string;
      agentType: AgentType;
      targetBranch: string;
    }) => {
      if (!activeProjectId) return;
      try {
        const ws = await ipc.invoke<Workspace>(IPC_CHANNELS.WORKSPACE_CREATE, {
          projectId: activeProjectId,
          name: data.name,
          branchName: data.branchName,
          targetBranch: data.targetBranch,
        });
        addWorkspace(ws);
        setActiveWorkspace(ws.id);
        notifications.show({
          title: 'Workspace created',
          message: `${data.name} is ready`,
          color: 'green',
        });
      } catch (err) {
        notifications.show({
          title: 'Failed to create workspace',
          message: String(err),
          color: 'red',
        });
      }
    },
    [activeProjectId, addWorkspace, setActiveWorkspace],
  );

  const handleToggleZen = useCallback(() => {
    setZenMode((z) => !z);
  }, []);

  useKeyboardShortcuts({
    toggleSidebar,
    createPR: () => {}, // Will be handled by workspace
    openDiff: () => {}, // Will be handled by workspace
    newWorkspace: openWsCreator,
    zenMode: handleToggleZen,
  });

  const showSidebar = sidebarOpen && !zenMode;

  return (
    <>
      <CommandPalette
        onToggleSidebar={toggleSidebar}
        onOpenSettings={openSettings}
        onCreateWorkspace={openWsCreator}
        onCreatePR={() => {}}
        onOpenDiff={() => {}}
      />

      <AppShell
        navbar={{
          width: 260,
          breakpoint: 'sm',
          collapsed: { desktop: !showSidebar, mobile: !showSidebar },
        }}
        padding={0}
      >
        <AppShell.Navbar bg="dark.8" style={{ borderRight: '1px solid var(--mantine-color-dark-5)' }}>
          <Sidebar onAddProject={handleAddProject} />
        </AppShell.Navbar>

        <AppShell.Main
          style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--mantine-color-dark-7)',
          }}
        >
          {/* Titlebar / toolbar */}
          <Group
            h={52}
            px="md"
            justify="space-between"
            className="titlebar-drag"
            style={{
              borderBottom: '1px solid var(--mantine-color-dark-5)',
              flexShrink: 0,
              paddingLeft: showSidebar ? 'var(--mantine-spacing-md)' : 80,
            }}
          >
            <Group gap="xs" className="titlebar-no-drag">
              <Tooltip label="Toggle sidebar (Cmd+B)" position="bottom">
                <ActionIcon variant="subtle" color="gray" onClick={toggleSidebar}>
                  <IconLayoutSidebar size={18} />
                </ActionIcon>
              </Tooltip>
              <Text size="sm" fw={600} c="dimmed">
                {activeWorkspace ? activeWorkspace.name : 'Maestro'}
              </Text>
            </Group>
            <Group gap="xs" className="titlebar-no-drag">
              {activeProjectId && (
                <Tooltip label="New workspace (Cmd+N)" position="bottom">
                  <ActionIcon variant="subtle" color="gray" onClick={openWsCreator}>
                    <IconPlus size={18} />
                  </ActionIcon>
                </Tooltip>
              )}
              <Tooltip label="Settings" position="bottom">
                <ActionIcon variant="subtle" color="gray" onClick={openSettings}>
                  <IconSettings size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>

          {/* Main content */}
          <Box style={{ flex: 1, overflow: 'hidden' }}>
            {activeWorkspace ? (
              <WorkspaceView workspace={activeWorkspace} />
            ) : (
              <WelcomeView onAddProject={handleAddProject} />
            )}
          </Box>
        </AppShell.Main>
      </AppShell>

      <SettingsDialog opened={settingsOpen} onClose={closeSettings} />

      <WorkspaceCreator
        opened={wsCreatorOpen}
        onClose={closeWsCreator}
        onSubmit={handleCreateWorkspace}
        projectName={activeProject?.name}
        defaultBranch={activeProject?.defaultBranch}
      />
    </>
  );
}
