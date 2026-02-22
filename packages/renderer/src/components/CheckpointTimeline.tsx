import { useEffect, useState, useCallback } from 'react';
import {
  Stack,
  Group,
  Text,
  Paper,
  Button,
  Timeline,
  Badge,
  Tooltip,
} from '@mantine/core';
import { IconCheck, IconGitBranch } from './Icons';
import { ipc } from '../services/ipc';
import { IPC_CHANNELS } from '@maestro/shared';
import type { Checkpoint } from '@maestro/shared';

interface CheckpointTimelineProps {
  workspaceId: string;
  workspacePath: string;
  onRevert?: () => void;
}

export function CheckpointTimeline({ workspaceId, workspacePath, onRevert }: CheckpointTimelineProps) {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [reverting, setReverting] = useState<number | null>(null);

  const loadCheckpoints = useCallback(async () => {
    const result = await ipc.invoke<Checkpoint[]>(IPC_CHANNELS.CHECKPOINT_LIST, workspaceId);
    setCheckpoints(result);
  }, [workspaceId]);

  useEffect(() => {
    loadCheckpoints();
  }, [loadCheckpoints]);

  const handleRevert = useCallback(
    async (checkpointId: number) => {
      setReverting(checkpointId);
      try {
        await ipc.invoke(IPC_CHANNELS.CHECKPOINT_REVERT, {
          workspacePath,
          checkpointId,
        });
        await loadCheckpoints();
        onRevert?.();
      } catch (err) {
        console.error('Revert failed:', err);
      } finally {
        setReverting(null);
      }
    },
    [workspacePath, loadCheckpoints, onRevert],
  );

  if (checkpoints.length === 0) {
    return (
      <Stack p="md" align="center">
        <Text size="sm" c="dimmed">
          No checkpoints yet. Checkpoints are created before each agent turn.
        </Text>
      </Stack>
    );
  }

  return (
    <Stack p="md">
      <Text size="sm" fw={600} mb="sm">
        Checkpoints
      </Text>

      <Timeline active={0} bulletSize={24} lineWidth={2}>
        {checkpoints.map((cp, i) => (
          <Timeline.Item
            key={cp.id}
            bullet={<IconGitBranch size={12} />}
            title={
              <Group gap="xs">
                <Text size="sm">
                  {cp.commitHash.substring(0, 8)}
                </Text>
                {i === 0 && (
                  <Badge size="xs" variant="light" color="green">
                    Current
                  </Badge>
                )}
              </Group>
            }
          >
            <Text size="xs" c="dimmed">
              {new Date(cp.createdAt).toLocaleString()}
            </Text>
            {cp.messageIndex !== null && (
              <Text size="xs" c="dimmed">
                After message #{cp.messageIndex}
              </Text>
            )}
            {i > 0 && (
              <Button
                size="xs"
                variant="subtle"
                color="orange"
                mt={4}
                onClick={() => handleRevert(cp.id)}
                loading={reverting === cp.id}
              >
                Revert to this checkpoint
              </Button>
            )}
          </Timeline.Item>
        ))}
      </Timeline>
    </Stack>
  );
}
