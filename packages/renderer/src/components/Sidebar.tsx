import {
  Stack,
  Group,
  Text,
  NavLink,
  ScrollArea,
  ActionIcon,
  Tooltip,
  Box,
  Divider,
  Badge,
} from '@mantine/core';
import { IconFolder, IconGitBranch, IconPlus, IconArchive, IconTrash } from './Icons';
import { useAppStore } from '../stores/appStore';

interface SidebarProps {
  onAddProject: () => void;
  onCreateWorkspace: () => void;
  onDeleteProject: (id: string) => void;
  onDeleteWorkspace: (id: string) => void;
}

export function Sidebar({ onAddProject, onCreateWorkspace, onDeleteProject, onDeleteWorkspace }: SidebarProps) {
  const projects = useAppStore((s) => s.projects);
  const workspaces = useAppStore((s) => s.workspaces);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const activeWorkspaceId = useAppStore((s) => s.activeWorkspaceId);
  const setActiveProject = useAppStore((s) => s.setActiveProject);
  const setActiveWorkspace = useAppStore((s) => s.setActiveWorkspace);

  const activeWorkspaces = workspaces.filter(
    (w) => w.projectId === activeProjectId && w.status === 'active',
  );

  return (
    <Stack h="100%" gap={0}>
      {/* Sidebar header with drag area for titlebar */}
      <Group
        h={52}
        px="md"
        justify="space-between"
        className="titlebar-drag"
        style={{ borderBottom: '1px solid var(--mantine-color-dark-5)', flexShrink: 0 }}
      >
        <Text size="xs" fw={700} c="dimmed" tt="uppercase" className="titlebar-no-drag">
          Projects
        </Text>
        <Tooltip label="Add project" position="right">
          <ActionIcon variant="subtle" color="gray" size="sm" className="titlebar-no-drag" onClick={onAddProject}>
            <IconPlus size={14} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {/* Projects list */}
      <ScrollArea flex={1} scrollbarSize={6}>
        <Stack gap={0} p="xs">
          {projects.length === 0 ? (
            <Text size="xs" c="dimmed" ta="center" py="xl">
              No projects yet.
              <br />
              Open a git repository to get started.
            </Text>
          ) : (
            projects.map((project) => (
              <Box key={project.id}>
                <NavLink
                  label={project.name}
                  leftSection={<IconFolder size={16} />}
                  active={activeProjectId === project.id}
                  onClick={() => setActiveProject(project.id)}
                  variant="light"
                  style={{ borderRadius: 'var(--mantine-radius-sm)' }}
                  rightSection={
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="xs"
                      aria-label={`Delete project ${project.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteProject(project.id);
                      }}
                    >
                      <IconTrash size={12} />
                    </ActionIcon>
                  }
                />
                {activeProjectId === project.id && (
                  <Stack gap={0} pl="md">
                    <Group px="xs" py={4} justify="space-between">
                      <Text size="xs" c="dimmed" fw={600}>
                        Workspaces
                      </Text>
                      <Tooltip label="New workspace" position="right">
                        <ActionIcon variant="subtle" color="gray" size="xs" aria-label="New workspace" onClick={onCreateWorkspace}>
                          <IconPlus size={12} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                    {activeWorkspaces.length === 0 ? (
                      <Text size="xs" c="dimmed" px="xs" py={4}>
                        No workspaces
                      </Text>
                    ) : (
                      activeWorkspaces.map((ws) => (
                        <NavLink
                          key={ws.id}
                          label={ws.name}
                          description={ws.branchName}
                          leftSection={<IconGitBranch size={14} />}
                          active={activeWorkspaceId === ws.id}
                          onClick={() => setActiveWorkspace(ws.id)}
                          variant="light"
                          rightSection={
                            <Group gap={4}>
                              {ws.prUrl && (
                                <Badge size="xs" variant="light" color="blue">
                                  PR
                                </Badge>
                              )}
                              <ActionIcon
                                variant="subtle"
                                color="red"
                                size="xs"
                                aria-label={`Delete workspace ${ws.name}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteWorkspace(ws.id);
                                }}
                              >
                                <IconTrash size={12} />
                              </ActionIcon>
                            </Group>
                          }
                          style={{ borderRadius: 'var(--mantine-radius-sm)' }}
                        />
                      ))
                    )}
                  </Stack>
                )}
              </Box>
            ))
          )}
        </Stack>
      </ScrollArea>
    </Stack>
  );
}
