import { useState, useEffect, useCallback } from 'react';
import { Stack, Text, NavLink, ScrollArea, Loader, Group } from '@mantine/core';
import { IconFolder, IconFile, IconChevronRight, IconChevronDown } from './Icons';
import { ipc } from '../services/ipc';
import { IPC_CHANNELS } from '@maestro/shared';
import type { FileEntry } from '@maestro/shared';

interface FileBrowserProps {
  workspacePath: string;
}

export function FileBrowser({ workspacePath }: FileBrowserProps) {
  const [rootEntries, setRootEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    ipc
      .invoke<FileEntry[]>(IPC_CHANNELS.FILE_LIST_DIR, { dirPath: workspacePath })
      .then(setRootEntries)
      .catch(() => setRootEntries([]))
      .finally(() => setLoading(false));
  }, [workspacePath]);

  if (loading) {
    return (
      <Stack align="center" justify="center" h="100%">
        <Loader size="sm" />
      </Stack>
    );
  }

  if (rootEntries.length === 0) {
    return (
      <Stack align="center" justify="center" h="100%">
        <Text size="sm" c="dimmed">
          Empty directory
        </Text>
      </Stack>
    );
  }

  return (
    <ScrollArea h="100%">
      <Stack gap={0} p="xs">
        {rootEntries.map((entry) => (
          <FileNode key={entry.path} entry={entry} depth={0} />
        ))}
      </Stack>
    </ScrollArea>
  );
}

function FileNode({ entry, depth }: { entry: FileEntry; depth: number }) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<FileEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  const handleToggle = useCallback(async () => {
    if (!entry.isDirectory) return;

    if (!expanded && children === null) {
      setLoading(true);
      try {
        const result = await ipc.invoke<FileEntry[]>(IPC_CHANNELS.FILE_LIST_DIR, {
          dirPath: entry.path,
        });
        setChildren(result);
      } catch {
        setChildren([]);
      } finally {
        setLoading(false);
      }
    }
    setExpanded((prev) => !prev);
  }, [entry, expanded, children]);

  return (
    <>
      <NavLink
        label={entry.name}
        leftSection={
          entry.isDirectory ? (
            expanded ? (
              <IconChevronDown size={12} />
            ) : (
              <IconChevronRight size={12} />
            )
          ) : (
            <IconFile size={14} />
          )
        }
        rightSection={loading ? <Loader size={10} /> : null}
        onClick={handleToggle}
        variant="subtle"
        active={false}
        style={{
          borderRadius: 'var(--mantine-radius-sm)',
          paddingLeft: 8 + depth * 16,
        }}
        styles={{
          label: { fontSize: 12 },
        }}
      />
      {expanded &&
        children?.map((child) => (
          <FileNode key={child.path} entry={child} depth={depth + 1} />
        ))}
    </>
  );
}
