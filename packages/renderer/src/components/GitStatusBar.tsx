import { useEffect, useState } from 'react';
import { Group, Text, Badge, Tooltip } from '@mantine/core';
import { IconGitBranch } from './Icons';
import { ipc } from '../services/ipc';
import { IPC_CHANNELS } from '@maestro/shared';
import type { GitStatus } from '@maestro/shared';

interface GitStatusBarProps {
  workspacePath: string;
}

export function GitStatusBar({ workspacePath }: GitStatusBarProps) {
  const [status, setStatus] = useState<GitStatus | null>(null);

  useEffect(() => {
    let active = true;

    async function poll() {
      while (active) {
        try {
          const result = await ipc.invoke<GitStatus>(IPC_CHANNELS.GIT_STATUS, workspacePath);
          if (active) setStatus(result);
        } catch {
          // ignore
        }
        // Poll every 5 seconds
        await new Promise((r) => setTimeout(r, 5000));
      }
    }

    poll();
    return () => {
      active = false;
    };
  }, [workspacePath]);

  if (!status) return null;

  const modifiedCount = status.files.filter((f) => f.status === 'modified').length;
  const addedCount = status.files.filter((f) => f.status === 'added' || f.status === 'untracked').length;
  const deletedCount = status.files.filter((f) => f.status === 'deleted').length;

  return (
    <Group
      h={28}
      px="md"
      gap="sm"
      style={{ borderBottom: '1px solid var(--mantine-color-dark-5)', flexShrink: 0 }}
      bg="dark.8"
    >
      <Group gap={4}>
        <IconGitBranch size={12} color="var(--mantine-color-dimmed)" />
        <Text size="xs" c="dimmed">
          {status.branch}
        </Text>
      </Group>

      {status.ahead > 0 && (
        <Tooltip label={`${status.ahead} commit(s) ahead of remote`}>
          <Badge size="xs" variant="light" color="green">
            ↑{status.ahead}
          </Badge>
        </Tooltip>
      )}

      {status.behind > 0 && (
        <Tooltip label={`${status.behind} commit(s) behind remote`}>
          <Badge size="xs" variant="light" color="orange">
            ↓{status.behind}
          </Badge>
        </Tooltip>
      )}

      {modifiedCount > 0 && (
        <Badge size="xs" variant="light" color="yellow">
          ~{modifiedCount}
        </Badge>
      )}

      {addedCount > 0 && (
        <Badge size="xs" variant="light" color="green">
          +{addedCount}
        </Badge>
      )}

      {deletedCount > 0 && (
        <Badge size="xs" variant="light" color="red">
          -{deletedCount}
        </Badge>
      )}

      {status.hasConflicts && (
        <Badge size="xs" variant="filled" color="red">
          Conflicts
        </Badge>
      )}
    </Group>
  );
}
