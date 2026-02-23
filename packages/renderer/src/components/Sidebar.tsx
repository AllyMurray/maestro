import { useState } from 'react';
import {
  Stack,
  Group,
  Text,
  NavLink,
  ScrollArea,
  ActionIcon,
  Tooltip,
  Badge,
  Select,
  Collapse,
  Box,
  Button,
} from '@mantine/core';
import { IconFolder, IconGitBranch, IconPlus, IconChevronDown, IconChevronRight } from './Icons';
import { useAppStore } from '../stores/appStore';
import type { Workspace, WorkspaceStatus } from '@maestro/shared';

interface SidebarProps {
  onAddProject: () => void;
  onCreateWorkspace: () => void;
  onDeleteProject: (id: string) => void;
  onDeleteWorkspace: (id: string) => void;
}

const STATUS_CONFIG: Record<WorkspaceStatus, { label: string; color: string; defaultOpen: boolean }> = {
  in_progress: { label: 'In progress', color: 'blue', defaultOpen: true },
  in_review: { label: 'In review', color: 'yellow', defaultOpen: true },
  backlog: { label: 'Backlog', color: 'gray', defaultOpen: true },
  done: { label: 'Done', color: 'green', defaultOpen: false },
  cancelled: { label: 'Cancelled', color: 'red', defaultOpen: false },
};

const STATUS_ORDER: WorkspaceStatus[] = ['in_progress', 'in_review', 'backlog', 'done', 'cancelled'];

function AgentTypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    'claude-code': 'CC',
    codex: 'CX',
    cursor: 'CR',
  };
  return (
    <Badge size="xs" variant="dot" color="gray">
      {labels[type] || type}
    </Badge>
  );
}

export function Sidebar({ onAddProject, onCreateWorkspace, onDeleteProject, onDeleteWorkspace }: SidebarProps) {
  const projects = useAppStore((s) => s.projects);
  const workspaces = useAppStore((s) => s.workspaces);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const activeWorkspaceId = useAppStore((s) => s.activeWorkspaceId);
  const setActiveProject = useAppStore((s) => s.setActiveProject);
  const setActiveWorkspace = useAppStore((s) => s.setActiveWorkspace);

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const status of STATUS_ORDER) {
      initial[status] = !STATUS_CONFIG[status].defaultOpen;
    }
    return initial;
  });

  const toggleSection = (status: string) => {
    setCollapsedSections((prev) => ({ ...prev, [status]: !prev[status] }));
  };

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const projectWorkspaces = workspaces.filter((w) => w.projectId === activeProjectId);

  // Group workspaces by status
  const groupedWorkspaces: Record<WorkspaceStatus, Workspace[]> = {
    in_progress: [],
    in_review: [],
    backlog: [],
    done: [],
    cancelled: [],
  };
  for (const ws of projectWorkspaces) {
    const status = ws.status as WorkspaceStatus;
    if (groupedWorkspaces[status]) {
      groupedWorkspaces[status].push(ws);
    } else {
      groupedWorkspaces.in_progress.push(ws);
    }
  }

  return (
    <Stack h="100%" gap={0}>
      {/* Sidebar header with drag area */}
      <Group
        h={52}
        px="md"
        justify="space-between"
        className="titlebar-drag"
        style={{ borderBottom: '1px solid var(--mantine-color-dark-5)', flexShrink: 0 }}
      >
        <Text size="xs" fw={700} c="dimmed" tt="uppercase" className="titlebar-no-drag">
          Maestro
        </Text>
      </Group>

      {/* Project selector */}
      <Box px="sm" py="xs" style={{ borderBottom: '1px solid var(--mantine-color-dark-5)' }}>
        {projects.length > 1 ? (
          <Select
            size="xs"
            data={projects.map((p) => ({ value: p.id, label: p.name }))}
            value={activeProjectId}
            onChange={(val) => val && setActiveProject(val)}
            placeholder="Select project"
          />
        ) : activeProject ? (
          <Group gap="xs">
            <IconFolder size={14} />
            <Text size="xs" fw={600} truncate>
              {activeProject.name}
            </Text>
          </Group>
        ) : (
          <Text size="xs" c="dimmed">
            No project selected
          </Text>
        )}
      </Box>

      {/* Workspaces grouped by status */}
      <ScrollArea flex={1} scrollbarSize={6}>
        {activeProjectId ? (
          <Stack gap={0} py="xs">
            {STATUS_ORDER.map((status) => {
              const items = groupedWorkspaces[status];
              if (items.length === 0 && (status === 'done' || status === 'cancelled')) return null;
              const config = STATUS_CONFIG[status];
              const isCollapsed = collapsedSections[status];

              return (
                <Box key={status}>
                  <Group
                    px="sm"
                    py={4}
                    gap="xs"
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => toggleSection(status)}
                  >
                    {isCollapsed ? (
                      <IconChevronRight size={10} />
                    ) : (
                      <IconChevronDown size={10} />
                    )}
                    <Text size="xs" fw={600} c="dimmed">
                      {config.label}
                    </Text>
                    {items.length > 0 && (
                      <Badge size="xs" variant="light" color={config.color} circle>
                        {items.length}
                      </Badge>
                    )}
                  </Group>
                  <Collapse in={!isCollapsed}>
                    <Stack gap={0} px={4}>
                      {items.length === 0 ? (
                        <Text size="xs" c="dimmed" px="sm" py={4}>
                          No workspaces
                        </Text>
                      ) : (
                        items.map((ws) => (
                          <NavLink
                            key={ws.id}
                            label={
                              <Group gap={4}>
                                <Text size="xs" truncate>
                                  {ws.name}
                                </Text>
                              </Group>
                            }
                            description={ws.branchName}
                            leftSection={<IconGitBranch size={14} />}
                            active={activeWorkspaceId === ws.id}
                            onClick={() => setActiveWorkspace(ws.id)}
                            variant="light"
                            rightSection={
                              <Group gap={4}>
                                <AgentTypeBadge type={ws.agentType} />
                                {ws.prUrl && (
                                  <Badge size="xs" variant="light" color="blue">
                                    PR
                                  </Badge>
                                )}
                              </Group>
                            }
                            style={{ borderRadius: 'var(--mantine-radius-sm)' }}
                            styles={{ label: { fontSize: 12 } }}
                          />
                        ))
                      )}
                    </Stack>
                  </Collapse>
                </Box>
              );
            })}
          </Stack>
        ) : (
          <Stack align="center" py="xl">
            <Text size="xs" c="dimmed" ta="center">
              No projects yet.
              <br />
              Add a repository to get started.
            </Text>
          </Stack>
        )}
      </ScrollArea>

      {/* Bottom actions */}
      <Stack gap={4} p="sm" style={{ borderTop: '1px solid var(--mantine-color-dark-5)' }}>
        {activeProjectId && (
          <Tooltip label="New workspace (Cmd+N)" position="right">
            <Button
              variant="subtle"
              color="gray"
              size="xs"
              fullWidth
              leftSection={<IconPlus size={12} />}
              onClick={onCreateWorkspace}
              justify="flex-start"
            >
              New workspace
            </Button>
          </Tooltip>
        )}
        <Tooltip label="Add repository" position="right">
          <Button
            variant="subtle"
            color="gray"
            size="xs"
            fullWidth
            leftSection={<IconFolder size={12} />}
            onClick={onAddProject}
            justify="flex-start"
          >
            Add repository
          </Button>
        </Tooltip>
      </Stack>
    </Stack>
  );
}
