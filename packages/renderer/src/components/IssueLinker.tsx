import { useState, useCallback } from 'react';
import { Modal, TextInput, Stack, Button, Group, Text, Paper, Badge, Loader } from '@mantine/core';
import { IconSearch } from './Icons';
import { ipc } from '../services/ipc';
import { IPC_CHANNELS } from '@maestro/shared';
import type { Issue, GitPlatform } from '@maestro/shared';

interface IssueLinkerProps {
  opened: boolean;
  onClose: () => void;
  workspaceId: string;
  repoPath: string;
  platform: GitPlatform;
}

export function IssueLinker({ opened, onClose, workspaceId, repoPath, platform }: IssueLinkerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Issue[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const issues = await ipc.invoke<Issue[]>(IPC_CHANNELS.ISSUE_SEARCH, {
        repoPath,
        platform,
        query,
      });
      setResults(issues);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [query, repoPath, platform]);

  const handleLink = useCallback(
    async (issue: Issue) => {
      await ipc.invoke(IPC_CHANNELS.ISSUE_LINK, {
        workspaceId,
        source: platform,
        issueId: issue.id,
        title: issue.title,
        url: issue.url,
      });
      onClose();
    },
    [workspaceId, platform, onClose],
  );

  return (
    <Modal opened={opened} onClose={onClose} title="Link Issue" size="lg">
      <Stack gap="md">
        <Group gap="sm">
          <TextInput
            flex={1}
            placeholder="Search issues..."
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            leftSection={<IconSearch size={14} />}
          />
          <Button onClick={handleSearch} loading={searching}>
            Search
          </Button>
        </Group>

        {searching ? (
          <Group justify="center" p="lg">
            <Loader size="sm" />
          </Group>
        ) : results.length > 0 ? (
          <Stack gap="xs" style={{ maxHeight: 400, overflow: 'auto' }}>
            {results.map((issue) => (
              <Paper
                key={issue.id}
                p="sm"
                bg="dark.6"
                radius="sm"
                style={{ cursor: 'pointer' }}
                onClick={() => handleLink(issue)}
              >
                <Group justify="space-between">
                  <Group gap="xs">
                    <Text size="xs" c="dimmed">
                      #{issue.number}
                    </Text>
                    <Text size="sm" fw={500}>
                      {issue.title}
                    </Text>
                  </Group>
                  <Group gap={4}>
                    {issue.labels.slice(0, 3).map((label) => (
                      <Badge key={label} size="xs" variant="light">
                        {label}
                      </Badge>
                    ))}
                  </Group>
                </Group>
              </Paper>
            ))}
          </Stack>
        ) : query && !searching ? (
          <Text size="sm" c="dimmed" ta="center">
            No issues found
          </Text>
        ) : null}
      </Stack>
    </Modal>
  );
}
