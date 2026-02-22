import { useEffect, useState, useCallback } from 'react';
import { Stack, Group, Text, Badge, Paper, Button, Loader, Tooltip, Box } from '@mantine/core';
import { IconCheck, IconX } from './Icons';
import { ipc } from '../services/ipc';
import { IPC_CHANNELS } from '@maestro/shared';
import type { CICheck, GitPlatform } from '@maestro/shared';

interface ChecksPanelProps {
  repoPath: string;
  platform: GitPlatform;
  prRef: string;
}

export function ChecksPanel({ repoPath, platform, prRef }: ChecksPanelProps) {
  const [checks, setChecks] = useState<CICheck[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await ipc.invoke<CICheck[]>(IPC_CHANNELS.PR_GET_CHECKS, {
        repoPath,
        platform,
        ref: prRef,
      });
      setChecks(result);
    } catch {
      setChecks([]);
    } finally {
      setLoading(false);
    }
  }, [repoPath, platform, prRef]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  const allPassed = checks.every((c) => c.conclusion === 'success');
  const hasFailures = checks.some((c) => c.conclusion === 'failure');

  if (loading && checks.length === 0) {
    return (
      <Group justify="center" p="xl">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">Loading checks...</Text>
      </Group>
    );
  }

  return (
    <Stack gap="sm" p="md">
      <Group justify="space-between">
        <Group gap="sm">
          <Text size="sm" fw={600}>CI Checks</Text>
          {checks.length > 0 && (
            <Badge
              size="sm"
              variant="light"
              color={allPassed ? 'green' : hasFailures ? 'red' : 'yellow'}
            >
              {allPassed
                ? 'All passed'
                : hasFailures
                ? `${checks.filter((c) => c.conclusion === 'failure').length} failed`
                : 'In progress'}
            </Badge>
          )}
        </Group>
        <Button size="xs" variant="subtle" onClick={refresh} loading={loading}>
          Refresh
        </Button>
      </Group>

      {checks.length === 0 ? (
        <Text size="sm" c="dimmed">No checks found</Text>
      ) : (
        checks.map((check, i) => (
          <CheckItem key={`${check.name}-${i}`} check={check} />
        ))
      )}
    </Stack>
  );
}

function CheckItem({ check }: { check: CICheck }) {
  const getIcon = () => {
    switch (check.conclusion) {
      case 'success':
        return <IconCheck size={14} color="var(--mantine-color-green-5)" />;
      case 'failure':
        return <IconX size={14} color="var(--mantine-color-red-5)" />;
      default:
        return check.status === 'in_progress' ? (
          <Loader size={14} />
        ) : (
          <Box w={14} h={14} style={{ borderRadius: '50%', background: 'var(--mantine-color-yellow-5)' }} />
        );
    }
  };

  return (
    <Paper p="sm" bg="dark.6" radius="sm">
      <Group justify="space-between">
        <Group gap="sm">
          {getIcon()}
          <Text size="sm">{check.name}</Text>
        </Group>
        <Group gap="xs">
          {check.conclusion && (
            <Badge
              size="xs"
              variant="light"
              color={check.conclusion === 'success' ? 'green' : check.conclusion === 'failure' ? 'red' : 'gray'}
            >
              {check.conclusion}
            </Badge>
          )}
          {check.url && (
            <Button
              size="xs"
              variant="subtle"
              component="a"
              href={check.url}
              target="_blank"
            >
              Details
            </Button>
          )}
        </Group>
      </Group>
    </Paper>
  );
}
