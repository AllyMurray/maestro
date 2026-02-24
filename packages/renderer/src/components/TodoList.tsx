import { useState, useEffect, useCallback } from 'react';
import {
  Stack,
  Group,
  Text,
  TextInput,
  Checkbox,
  ActionIcon,
  Paper,
  Badge,
  Tooltip,
} from '@mantine/core';
import { IconPlus, IconTrash } from './Icons';
import { ipc } from '../services/ipc';
import { IPC_CHANNELS } from '@maestro/shared';
import type { Todo } from '@maestro/shared';

interface TodoListProps {
  workspaceId: string;
}

export function TodoList({ workspaceId }: TodoListProps) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTitle, setNewTitle] = useState('');

  const loadTodos = useCallback(async () => {
    const result = await ipc.invoke<Todo[]>(IPC_CHANNELS.TODO_LIST, workspaceId);
    setTodos(result);
  }, [workspaceId]);

  useEffect(() => {
    loadTodos();
  }, [loadTodos]);

  const handleAdd = useCallback(async () => {
    if (!newTitle.trim()) return;
    await ipc.invoke(IPC_CHANNELS.TODO_CREATE, {
      workspaceId,
      title: newTitle.trim(),
    });
    setNewTitle('');
    await loadTodos();
  }, [newTitle, workspaceId, loadTodos]);

  const handleToggle = useCallback(
    async (id: number, completed: boolean) => {
      await ipc.invoke(IPC_CHANNELS.TODO_UPDATE, {
        id,
        isCompleted: completed,
      });
      await loadTodos();
    },
    [loadTodos],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      await ipc.invoke(IPC_CHANNELS.TODO_DELETE, id);
      await loadTodos();
    },
    [loadTodos],
  );

  const completedCount = todos.filter((t) => t.isCompleted).length;
  const blockerCount = todos.filter((t) => t.blocksMerge && !t.isCompleted).length;

  return (
    <Stack gap="sm" p="md">
      <Group justify="space-between">
        <Group gap="sm">
          <Text size="sm" fw={600}>
            Todos
          </Text>
          <Badge size="xs" variant="light">
            {completedCount}/{todos.length}
          </Badge>
        </Group>
        {blockerCount > 0 && (
          <Badge size="xs" variant="light" color="red">
            {blockerCount} blocking merge
          </Badge>
        )}
      </Group>

      {/* Add new todo */}
      <Group gap="xs">
        <TextInput
          flex={1}
          size="sm"
          placeholder="Add a todo..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <ActionIcon variant="light" onClick={handleAdd} disabled={!newTitle.trim()}>
          <IconPlus size={14} />
        </ActionIcon>
      </Group>

      {/* Todo items */}
      {todos.map((todo) => (
        <Paper key={todo.id} p="xs" bg="dark.6" radius="sm">
          <Group justify="space-between">
            <Group gap="sm">
              <Checkbox
                size="sm"
                checked={todo.isCompleted}
                onChange={(e) => handleToggle(todo.id, e.currentTarget.checked)}
              />
              <Text
                size="sm"
                td={todo.isCompleted ? 'line-through' : undefined}
                c={todo.isCompleted ? 'dimmed' : undefined}
              >
                {todo.title}
              </Text>
            </Group>
            <Group gap={4}>
              {todo.blocksMerge && (
                <Tooltip label="Blocks merge">
                  <Badge size="xs" variant="light" color="red">
                    Blocker
                  </Badge>
                </Tooltip>
              )}
              <ActionIcon
                variant="subtle"
                size="xs"
                color="red"
                aria-label={`Delete todo: ${todo.title}`}
                onClick={() => handleDelete(todo.id)}
              >
                <IconTrash size={12} />
              </ActionIcon>
            </Group>
          </Group>
        </Paper>
      ))}

      {todos.length === 0 && (
        <Text size="sm" c="dimmed" ta="center">
          No todos yet
        </Text>
      )}
    </Stack>
  );
}
