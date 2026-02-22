import { useEffect, useState, useCallback } from 'react';
import {
  Stack,
  Group,
  Text,
  Badge,
  Paper,
  Button,
  Divider,
  Select,
  ScrollArea,
  Loader,
} from '@mantine/core';
import { ChecksPanel } from './ChecksPanel';
import { ipc } from '../services/ipc';
import { IPC_CHANNELS } from '@maestro/shared';
import type { PRDetails, PRComment, GitPlatform, MergeStrategy } from '@maestro/shared';

interface PRViewProps {
  repoPath: string;
  platform: GitPlatform;
  prId: string;
}

export function PRView({ repoPath, platform, prId }: PRViewProps) {
  const [pr, setPR] = useState<PRDetails | null>(null);
  const [comments, setComments] = useState<PRComment[]>([]);
  const [mergeStrategy, setMergeStrategy] = useState<MergeStrategy>('squash');
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState(false);

  const label = platform === 'gitlab' ? 'MR' : 'PR';

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [prData, commentsData] = await Promise.all([
        ipc.invoke<PRDetails>(IPC_CHANNELS.PR_GET, { repoPath, platform, prId }),
        ipc.invoke<PRComment[]>(IPC_CHANNELS.PR_LIST_COMMENTS, { repoPath, platform, prId }),
      ]);
      setPR(prData);
      setComments(commentsData);
    } catch (err) {
      console.error('Failed to load PR:', err);
    } finally {
      setLoading(false);
    }
  }, [repoPath, platform, prId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleMerge = useCallback(async () => {
    if (!pr) return;
    setMerging(true);
    try {
      await ipc.invoke(IPC_CHANNELS.PR_MERGE, {
        repoPath,
        platform,
        prId,
        strategy: mergeStrategy,
      });
      await refresh();
    } catch (err) {
      console.error('Failed to merge:', err);
    } finally {
      setMerging(false);
    }
  }, [pr, repoPath, platform, prId, mergeStrategy, refresh]);

  if (loading && !pr) {
    return (
      <Group justify="center" p="xl">
        <Loader size="sm" />
      </Group>
    );
  }

  if (!pr) {
    return <Text c="dimmed" p="md">Failed to load {label}</Text>;
  }

  return (
    <ScrollArea h="100%">
      <Stack p="md" gap="md">
        {/* Header */}
        <Group justify="space-between">
          <Group gap="sm">
            <Text size="lg" fw={700}>
              {pr.title}
            </Text>
            <Badge
              variant="light"
              color={pr.state === 'open' || pr.state === 'opened' ? 'green' : pr.state === 'merged' ? 'violet' : 'red'}
            >
              {pr.state}
            </Badge>
          </Group>
          <Text size="xs" c="dimmed">
            #{pr.number}
          </Text>
        </Group>

        {/* Branch info */}
        <Group gap="xs">
          <Badge variant="outline" size="sm">
            {pr.baseBranch}
          </Badge>
          <Text size="xs" c="dimmed">←</Text>
          <Badge variant="outline" size="sm">
            {pr.headBranch}
          </Badge>
        </Group>

        {/* Description */}
        {pr.body && (
          <Paper p="md" bg="dark.6" radius="sm">
            <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
              {pr.body}
            </Text>
          </Paper>
        )}

        <Divider />

        {/* Checks */}
        <ChecksPanel repoPath={repoPath} platform={platform} prRef={prId} />

        <Divider />

        {/* Comments */}
        <Stack gap="sm">
          <Text size="sm" fw={600}>
            Comments ({comments.length})
          </Text>
          {comments.map((comment) => (
            <Paper key={comment.id} p="sm" bg="dark.6" radius="sm">
              <Group gap="xs" mb={4}>
                <Text size="xs" fw={600}>
                  {comment.author}
                </Text>
                <Text size="xs" c="dimmed">
                  {new Date(comment.createdAt).toLocaleDateString()}
                </Text>
              </Group>
              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                {comment.body}
              </Text>
            </Paper>
          ))}
        </Stack>

        {/* Merge controls */}
        {(pr.state === 'open' || pr.state === 'opened') && (
          <>
            <Divider />
            <Group justify="space-between">
              <Select
                size="sm"
                w={160}
                value={mergeStrategy}
                onChange={(v) => v && setMergeStrategy(v as MergeStrategy)}
                data={[
                  { value: 'squash', label: 'Squash & Merge' },
                  { value: 'merge', label: 'Merge Commit' },
                  { value: 'rebase', label: 'Rebase & Merge' },
                ]}
              />
              <Button
                color={pr.mergeable ? 'green' : 'red'}
                onClick={handleMerge}
                loading={merging}
                disabled={!pr.mergeable}
              >
                {pr.mergeable ? `Merge ${label}` : `Cannot merge ${label}`}
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </ScrollArea>
  );
}
