import { Spotlight, SpotlightActionData } from '@mantine/spotlight';
import {
  IconFolder,
  IconPlus,
  IconSettings,
  IconTerminal,
  IconSearch,
  IconLayoutSidebar,
  IconPanelRight,
} from './Icons';
import { useAppStore } from '../stores/appStore';

interface CommandPaletteProps {
  onToggleSidebar: () => void;
  onToggleRightPanel: () => void;
  onOpenSettings: () => void;
  onCreateWorkspace: () => void;
}

export function CommandPalette({
  onToggleSidebar,
  onToggleRightPanel,
  onOpenSettings,
  onCreateWorkspace,
}: CommandPaletteProps) {
  const projects = useAppStore((s) => s.projects);
  const workspaces = useAppStore((s) => s.workspaces);
  const setActiveProject = useAppStore((s) => s.setActiveProject);
  const setActiveWorkspace = useAppStore((s) => s.setActiveWorkspace);
  const setRightPanelTab = useAppStore((s) => s.setRightPanelTab);

  const actions: SpotlightActionData[] = [
    {
      id: 'new-workspace',
      label: 'New Workspace',
      description: 'Create a new workspace with an AI agent',
      leftSection: <IconPlus size={18} />,
      onClick: onCreateWorkspace,
    },
    {
      id: 'show-changes',
      label: 'Show Changes',
      description: 'View file changes in the right panel',
      leftSection: <IconSearch size={18} />,
      onClick: () => setRightPanelTab('changes'),
    },
    {
      id: 'show-files',
      label: 'Show Files',
      description: 'Browse files in the right panel',
      leftSection: <IconFolder size={18} />,
      onClick: () => setRightPanelTab('files'),
    },
    {
      id: 'toggle-sidebar',
      label: 'Toggle Sidebar',
      description: 'Show or hide the sidebar',
      leftSection: <IconLayoutSidebar size={18} />,
      onClick: onToggleSidebar,
    },
    {
      id: 'toggle-right-panel',
      label: 'Toggle Right Panel',
      description: 'Show or hide the inspector panel',
      leftSection: <IconPanelRight size={18} />,
      onClick: onToggleRightPanel,
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
      .filter((w) => w.status !== 'cancelled')
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
