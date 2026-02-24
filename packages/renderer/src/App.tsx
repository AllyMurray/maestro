import { useCallback, useEffect, useState } from 'react';
import { Group, Box, ActionIcon, Tooltip, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconSettings, IconLayoutSidebar, IconPlus, IconPanelRight } from './components/Icons';
import { ThreeColumnLayout } from './components/ThreeColumnLayout';
import { Sidebar } from './components/Sidebar';
import { WelcomeView } from './components/WelcomeView';
import { CenterPanel } from './components/CenterPanel';
import { RightPanel } from './components/RightPanel';
import { CommandPalette } from './components/CommandPalette';
import { SettingsDialog } from './components/SettingsDialog';
import { WorkspaceCreator } from './components/WorkspaceCreator';
import { useAppStore } from './stores/appStore';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { ipc } from './services/ipc';
import { IPC_CHANNELS } from '@maestro/shared';
import type { Project, Workspace, AgentType, WorkspaceStatus } from '@maestro/shared';

export function resolveInitialActiveProjectId(
  projects: Project[],
  currentActiveProjectId: string | null,
  savedActiveProjectId: string | null,
): string | null {
  if (projects.length === 0) return null;

  if (currentActiveProjectId && projects.some((p) => p.id === currentActiveProjectId)) {
    return currentActiveProjectId;
  }

  if (savedActiveProjectId && projects.some((p) => p.id === savedActiveProjectId)) {
    return savedActiveProjectId;
  }

  return projects[0].id;
}

export default function App() {
  const [sidebarOpen, { toggle: toggleSidebar }] = useDisclosure(true);
  const [settingsOpen, { open: openSettings, close: closeSettings }] = useDisclosure(false);
  const [wsCreatorOpen, { open: openWsCreator, close: closeWsCreator }] = useDisclosure(false);
  const [zenMode, setZenMode] = useState(false);

  const activeWorkspaceId = useAppStore((s) => s.activeWorkspaceId);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const workspaces = useAppStore((s) => s.workspaces);
  const projects = useAppStore((s) => s.projects);
  const rightPanelOpen = useAppStore((s) => s.rightPanelOpen);
  const toggleRightPanel = useAppStore((s) => s.toggleRightPanel);
  const setProjects = useAppStore((s) => s.setProjects);
  const setWorkspaces = useAppStore((s) => s.setWorkspaces);
  const addWorkspace = useAppStore((s) => s.addWorkspace);
  const setActiveWorkspace = useAppStore((s) => s.setActiveWorkspace);
  const removeProject = useAppStore((s) => s.removeProject);
  const removeWorkspace = useAppStore((s) => s.removeWorkspace);
  const updateWorkspace = useAppStore((s) => s.updateWorkspace);
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

      const existingInStore = projects.find((p) => p.id === project.id);
      if (!existingInStore) {
        addProject(project);
        notifications.show({
          title: 'Project added',
          message: name,
          color: 'green',
        });
      }
      setActiveProject(project.id);
    } catch (err) {
      notifications.show({
        title: 'Failed to add project',
        message: String(err),
        color: 'red',
      });
    }
  }, [projects, addProject, setActiveProject]);

  // Load projects on startup
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const loadedProjects = await ipc.invoke<Project[]>(IPC_CHANNELS.PROJECT_LIST);
        if (cancelled) return;

        setProjects(loadedProjects);

        const savedActiveProjectId = await ipc
          .invoke<string | null>(IPC_CHANNELS.CONFIG_GET, 'last_active_project_id')
          .catch(() => null);
        if (cancelled) return;

        const nextActiveProjectId = resolveInitialActiveProjectId(
          loadedProjects,
          activeProjectId,
          savedActiveProjectId,
        );

        if (nextActiveProjectId !== activeProjectId) {
          setActiveProject(nextActiveProjectId);
        }
      } catch (err) {
        if (cancelled) return;
        notifications.show({
          title: 'Failed to load repositories',
          message: String(err),
          color: 'red',
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProjectId, setActiveProject, setProjects]);

  useEffect(() => {
    if (!activeProjectId) return;
    ipc.invoke(IPC_CHANNELS.CONFIG_SET, 'last_active_project_id', activeProjectId).catch(() => {});
  }, [activeProjectId]);

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
          agentType: data.agentType,
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

  const handleDeleteProject = useCallback(
    async (id: string) => {
      if (!confirm('Delete this project? Workspaces will also be removed.')) return;
      try {
        await ipc.invoke(IPC_CHANNELS.PROJECT_DELETE, id);
        removeProject(id);
        notifications.show({
          title: 'Project deleted',
          message: 'Project has been removed',
          color: 'green',
        });
      } catch (err) {
        notifications.show({
          title: 'Failed to delete project',
          message: String(err),
          color: 'red',
        });
      }
    },
    [removeProject],
  );

  const handleDeleteWorkspace = useCallback(
    async (id: string) => {
      if (!confirm('Delete this workspace?')) return;
      try {
        await ipc.invoke(IPC_CHANNELS.WORKSPACE_DELETE, id);
        removeWorkspace(id);
        notifications.show({
          title: 'Workspace deleted',
          message: 'Workspace has been removed',
          color: 'green',
        });
      } catch (err) {
        notifications.show({
          title: 'Failed to delete workspace',
          message: String(err),
          color: 'red',
        });
      }
    },
    [removeWorkspace],
  );

  const handleChangeWorkspaceStatus = useCallback(
    async (id: string, status: WorkspaceStatus) => {
      try {
        await ipc.invoke(IPC_CHANNELS.WORKSPACE_UPDATE_STATUS, { id, status });
        updateWorkspace(id, { status });
      } catch (err) {
        notifications.show({
          title: 'Failed to update status',
          message: String(err),
          color: 'red',
        });
      }
    },
    [updateWorkspace],
  );

  useKeyboardShortcuts({
    toggleSidebar,
    toggleRightPanel,
    newWorkspace: openWsCreator,
    zenMode: handleToggleZen,
  });

  const showSidebar = sidebarOpen && !zenMode;
  const showRight = rightPanelOpen && !zenMode && !!activeWorkspace;

  return (
    <>
      <CommandPalette
        onToggleSidebar={toggleSidebar}
        onToggleRightPanel={toggleRightPanel}
        onOpenSettings={openSettings}
        onCreateWorkspace={openWsCreator}
      />

      <Box
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
            {activeWorkspace && (
              <Tooltip label="Toggle right panel (Cmd+J)" position="bottom">
                <ActionIcon variant="subtle" color="gray" onClick={toggleRightPanel}>
                  <IconPanelRight size={18} />
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

        {/* Main 3-column layout */}
        <Box style={{ flex: 1, overflow: 'hidden' }}>
          <ThreeColumnLayout
            showLeft={showSidebar}
            showRight={showRight}
            left={
              <Sidebar
                onAddProject={handleAddProject}
                onCreateWorkspace={openWsCreator}
                onDeleteProject={handleDeleteProject}
                onDeleteWorkspace={handleDeleteWorkspace}
                onChangeStatus={handleChangeWorkspaceStatus}
              />
            }
            center={
              activeWorkspace && activeProject ? (
                <CenterPanel
                  workspace={activeWorkspace}
                  project={activeProject}
                  onDeleteWorkspace={handleDeleteWorkspace}
                />
              ) : (
                <WelcomeView onAddProject={handleAddProject} />
              )
            }
            right={
              activeWorkspace && activeProject ? (
                <RightPanel workspace={activeWorkspace} project={activeProject} />
              ) : null
            }
          />
        </Box>
      </Box>

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
