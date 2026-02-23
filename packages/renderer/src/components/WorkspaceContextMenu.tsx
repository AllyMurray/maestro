import { useState, useCallback } from 'react';
import { Menu } from '@mantine/core';
import type { WorkspaceStatus } from '@maestro/shared';

interface WorkspaceContextMenuProps {
  children: React.ReactNode;
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

export function WorkspaceContextMenu({ children, onChangeStatus, onDelete }: WorkspaceContextMenuProps) {
  const [opened, setOpened] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPosition({ x: e.clientX, y: e.clientY });
    setOpened(true);
  }, []);

  return (
    <Menu
      opened={opened}
      onChange={setOpened}
      position="bottom-start"
      offset={{ mainAxis: 0, crossAxis: 0 }}
      floatingStrategy="fixed"
      middlewares={{
        flip: true,
        shift: true,
      }}
    >
      <Menu.Target>
        <div onContextMenu={handleContextMenu} style={{ position: 'relative' }}>
          {children}
          {/* Invisible anchor positioned at cursor */}
          {opened && (
            <div
              style={{
                position: 'fixed',
                left: position.x,
                top: position.y,
                width: 0,
                height: 0,
                pointerEvents: 'none',
              }}
            />
          )}
        </div>
      </Menu.Target>
      <Menu.Dropdown
        style={
          opened
            ? {
                position: 'fixed',
                left: position.x,
                top: position.y,
              }
            : undefined
        }
      >
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
