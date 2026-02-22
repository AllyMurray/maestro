import { useEffect, useState, useCallback } from 'react';
import {
  Stack,
  Group,
  Text,
  Paper,
  Badge,
  ScrollArea,
  NavLink,
  Box,
  Code,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { IconCheck, IconPlus, IconX } from './Icons';
import { ipc } from '../services/ipc';
import { IPC_CHANNELS } from '@maestro/shared';
import type { DiffFile } from '@maestro/shared';

interface DiffViewerProps {
  workspacePath: string;
  base?: string;
}

export function DiffViewer({ workspacePath, base }: DiffViewerProps) {
  const [files, setFiles] = useState<DiffFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diffContent, setDiffContent] = useState('');
  const [loading, setLoading] = useState(true);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const result = await ipc.invoke<DiffFile[]>(IPC_CHANNELS.GIT_DIFF_FILES, {
        workspacePath,
        base,
      });
      const parsed = Array.isArray(result) ? result : [];
      setFiles(parsed);
      if (parsed.length > 0 && !selectedFile) {
        setSelectedFile(parsed[0].path);
      }
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [workspacePath, base, selectedFile]);

  const loadDiff = useCallback(async () => {
    if (!selectedFile) return;
    try {
      const diff = await ipc.invoke<string>(IPC_CHANNELS.GIT_DIFF, {
        workspacePath,
        filePath: selectedFile,
      });
      setDiffContent(diff);
    } catch {
      setDiffContent('');
    }
  }, [workspacePath, selectedFile]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  useEffect(() => {
    loadDiff();
  }, [loadDiff]);

  const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
  const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);

  return (
    <Stack h="100%" gap={0}>
      {/* Header */}
      <Group
        h={44}
        px="md"
        justify="space-between"
        style={{ borderBottom: '1px solid var(--mantine-color-dark-5)', flexShrink: 0 }}
      >
        <Group gap="sm">
          <Text size="sm" fw={600}>
            Changes
          </Text>
          <Badge size="xs" variant="light">
            {files.length} files
          </Badge>
        </Group>
        <Group gap={4}>
          <Text size="xs" c="green">
            +{totalAdditions}
          </Text>
          <Text size="xs" c="red">
            -{totalDeletions}
          </Text>
        </Group>
      </Group>

      <Group style={{ flex: 1, overflow: 'hidden' }} gap={0} align="stretch">
        {/* File list */}
        <ScrollArea
          w={250}
          style={{ borderRight: '1px solid var(--mantine-color-dark-5)' }}
        >
          <Stack gap={0} p="xs">
            {files.map((file) => (
              <NavLink
                key={file.path}
                label={file.path.split('/').pop()}
                description={file.path}
                active={selectedFile === file.path}
                onClick={() => setSelectedFile(file.path)}
                variant="light"
                rightSection={
                  <Group gap={4}>
                    <Text size="xs" c="green">
                      +{file.additions}
                    </Text>
                    <Text size="xs" c="red">
                      -{file.deletions}
                    </Text>
                  </Group>
                }
                leftSection={
                  <FileStatusIcon status={file.status} />
                }
                style={{ borderRadius: 'var(--mantine-radius-sm)' }}
              />
            ))}
          </Stack>
        </ScrollArea>

        {/* Diff content */}
        <ScrollArea flex={1}>
          {diffContent ? (
            <DiffDisplay content={diffContent} />
          ) : selectedFile ? (
            <Text c="dimmed" p="xl" ta="center">
              No changes
            </Text>
          ) : (
            <Text c="dimmed" p="xl" ta="center">
              Select a file to view diff
            </Text>
          )}
        </ScrollArea>
      </Group>
    </Stack>
  );
}

function FileStatusIcon({ status }: { status: DiffFile['status'] }) {
  switch (status) {
    case 'added':
      return <Text size="xs" c="green" fw={700}>A</Text>;
    case 'deleted':
      return <Text size="xs" c="red" fw={700}>D</Text>;
    case 'renamed':
      return <Text size="xs" c="blue" fw={700}>R</Text>;
    default:
      return <Text size="xs" c="yellow" fw={700}>M</Text>;
  }
}

function DiffDisplay({ content }: { content: string }) {
  const lines = content.split('\n');

  return (
    <Box
      p="sm"
      style={{
        fontFamily: 'var(--mantine-font-family-monospace)',
        fontSize: 12,
        lineHeight: 1.6,
      }}
    >
      {lines.map((line, i) => {
        let bg = 'transparent';
        let color = 'var(--mantine-color-gray-4)';

        if (line.startsWith('+') && !line.startsWith('+++')) {
          bg = 'rgba(46, 160, 67, 0.15)';
          color = 'var(--mantine-color-green-4)';
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          bg = 'rgba(248, 81, 73, 0.15)';
          color = 'var(--mantine-color-red-4)';
        } else if (line.startsWith('@@')) {
          color = 'var(--mantine-color-blue-4)';
        } else if (line.startsWith('diff') || line.startsWith('index')) {
          color = 'var(--mantine-color-dimmed)';
        }

        return (
          <Box
            key={i}
            style={{
              background: bg,
              color,
              padding: '0 8px',
              whiteSpace: 'pre',
              minHeight: 20,
            }}
          >
            <Text
              component="span"
              size="xs"
              c="dimmed"
              style={{
                display: 'inline-block',
                width: 40,
                textAlign: 'right',
                marginRight: 8,
                userSelect: 'none',
              }}
            >
              {i + 1}
            </Text>
            {line}
          </Box>
        );
      })}
    </Box>
  );
}
