import { Menu, ActionIcon } from '@mantine/core';
import { IconDotsVertical } from './Icons';

interface WorkspaceHeaderMenuProps {
  onOpenCheckpoints: () => void;
  onOpenTodos: () => void;
  onOpenPR: () => void;
  onLinkIssue: () => void;
  onChangeStatus: () => void;
  onDelete: () => void;
  hasPR: boolean;
  hasGitPlatform: boolean;
}

export function WorkspaceHeaderMenu({
  onOpenCheckpoints,
  onOpenTodos,
  onOpenPR,
  onLinkIssue,
  onChangeStatus,
  onDelete,
  hasPR,
  hasGitPlatform,
}: WorkspaceHeaderMenuProps) {
  return (
    <Menu shadow="md" width={200} position="bottom-end">
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" size="sm" aria-label="Workspace actions">
          <IconDotsVertical size={14} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item onClick={onOpenCheckpoints}>Checkpoints</Menu.Item>
        <Menu.Item onClick={onOpenTodos}>Todos</Menu.Item>
        <Menu.Divider />
        {hasGitPlatform && (
          <>
            <Menu.Item onClick={onOpenPR}>{hasPR ? 'View PR' : 'Create PR'}</Menu.Item>
            <Menu.Item onClick={onLinkIssue}>Link Issue</Menu.Item>
          </>
        )}
        <Menu.Item onClick={onChangeStatus}>Change Status</Menu.Item>
        <Menu.Divider />
        <Menu.Item color="red" onClick={onDelete}>
          Delete Workspace
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
