import { Spotlight, SpotlightActionData } from '@mantine/spotlight';
import { Group, Text } from '@mantine/core';
import {
  IconFolder,
  IconPlus,
  IconGitPullRequest,
  IconSettings,
  IconTerminal,
  IconSearch,
  IconLayoutSidebar,
} from './Icons';
import { useAppStore } from '../stores/appStore';

interface CommandPaletteProps {
  onToggleSidebar: () => void;
  onOpenSettings: () => void;
  onCreateWorkspace: () => void;
  onCreatePR: () => void;
  onOpenDiff: () => void;
}

export function CommandPalette({
  onToggleSidebar,
  onOpenSettings,
  onCreateWorkspace,
  onCreatePR,
  onOpenDiff,
}: CommandPaletteProps) {
  const projects = useAppStore((s) => s.projects);
  const workspaces = useAppStore((s) => s.workspaces);
  const setActiveProject = useAppStore((s) => s.setActiveProject);
  const setActiveWorkspace = useAppStore((s) => s.setActiveWorkspace);

  const actions: SpotlightActionData[] = [
    {
      id: 'new-workspace',
      label: 'New Workspace',
      description: 'Create a new workspace with an AI agent',
      leftSection: <IconPlus size={18} />,
      onClick: onCreateWorkspace,
    },
    {
      id: 'create-pr',
      label: 'Create Pull Request',
      description: 'Create a PR/MR for the current workspace',
      leftSection: <IconGitPullRequest size={18} />,
      onClick: onCreatePR,
    },
    {
      id: 'open-diff',
      label: 'Open Diff Viewer',
      description: 'View changes in the current workspace',
      leftSection: <IconSearch size={18} />,
      onClick: onOpenDiff,
    },
    {
      id: 'toggle-sidebar',
      label: 'Toggle Sidebar',
      description: 'Show or hide the sidebar',
      leftSection: <IconLayoutSidebar size={18} />,
      onClick: onToggleSidebar,
    },
    {
      id: 'settings',
      label: 'Settings',
      description: 'Open application settings',
      leftSection: <IconSettings size={18} />,
      onClick: onOpenSettings,
    },
    // Dynamic project/workspace actions
    ...projects.map((p) => ({
      id: `project-${p.id}`,
      label: p.name,
      description: `Switch to project: ${p.path}`,
      leftSection: <IconFolder size={18} />,
      onClick: () => setActiveProject(p.id),
    })),
    ...workspaces
      .filter((w) => w.status === 'active')
      .map((w) => ({
        id: `workspace-${w.id}`,
        label: w.name,
        description: `Switch to workspace: ${w.branchName}`,
        leftSection: <IconTerminal size={18} />,
        onClick: () => setActiveWorkspace(w.id),
      })),
  ];

  return (
    <Spotlight
      actions={actions}
      searchProps={{
        placeholder: 'Search commands...',
      }}
      shortcut="mod+K"
      nothingFound="No commands found"
      highlightQuery
    />
  );
}
