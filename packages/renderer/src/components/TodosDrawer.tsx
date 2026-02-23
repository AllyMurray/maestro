import { Drawer } from '@mantine/core';
import { TodoList } from './TodoList';

interface TodosDrawerProps {
  opened: boolean;
  onClose: () => void;
  workspaceId: string;
}

export function TodosDrawer({ opened, onClose, workspaceId }: TodosDrawerProps) {
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title="Todos"
      position="right"
      size="md"
    >
      <TodoList workspaceId={workspaceId} />
    </Drawer>
  );
}
