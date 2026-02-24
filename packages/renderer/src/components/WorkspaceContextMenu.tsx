import { Menu, ActionIcon } from '@mantine/core';
import type { WorkspaceStatus } from '@maestro/shared';
import { IconDotsVertical } from './Icons';

interface WorkspaceContextMenuProps {
  onChangeStatus: (status: WorkspaceStatus) => void;
  onDelete: () => void;
}

const STATUS_OPTIONS: { value: WorkspaceStatus; label: string }[] = [
  { value: 'in_progress', label: 'In progress' },
  { value: 'in_review', label: 'In review' },
  { value: 'backlog', label: 'Backlog' },
  { value: 'done', label: 'Done' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function WorkspaceContextMenu({ onChangeStatus, onDelete }: WorkspaceContextMenuProps) {
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          aria-label="Workspace actions"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <IconDotsVertical size={14} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Change status</Menu.Label>
        {STATUS_OPTIONS.map((opt) => (
          <Menu.Item key={opt.value} onClick={() => onChangeStatus(opt.value)}>
            {opt.label}
          </Menu.Item>
        ))}
        <Menu.Divider />
        <Menu.Item color="red" onClick={onDelete}>
          Delete workspace
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
