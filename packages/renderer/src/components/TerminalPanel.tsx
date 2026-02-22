import { useEffect, useRef, useState, useCallback } from 'react';
import { Stack, Group, Text, ActionIcon, Tooltip, Box } from '@mantine/core';
import { IconPlus, IconX } from './Icons';
import { ipc } from '../services/ipc';
import { IPC_CHANNELS } from '@maestro/shared';

interface TerminalPanelProps {
  workspacePath: string;
}

export function TerminalPanel({ workspacePath }: TerminalPanelProps) {
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [output, setOutput] = useState<string[]>([]);
  const outputRef = useRef<HTMLPreElement>(null);

  const createNewTerminal = useCallback(async () => {
    const result = await ipc.invoke<{ id: string }>(IPC_CHANNELS.TERMINAL_CREATE, {
      workspacePath,
    });
    setTerminalId(result.id);
    setOutput([]);
  }, [workspacePath]);

  // Listen for terminal data
  useEffect(() => {
    if (!terminalId) return;
    const unsub = ipc.on(IPC_CHANNELS.TERMINAL_DATA, (data: unknown) => {
      const { terminalId: tid, data: text } = data as { terminalId: string; data: string };
      if (tid === terminalId) {
        setOutput((prev) => [...prev, text]);
      }
    });
    return unsub;
  }, [terminalId]);

  // Auto-scroll
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  // Create terminal on mount
  useEffect(() => {
    createNewTerminal();
    return () => {
      if (terminalId) {
        ipc.invoke(IPC_CHANNELS.TERMINAL_CLOSE, terminalId);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleInput = useCallback(
    (e: React.KeyboardEvent) => {
      if (!terminalId) return;
      if (e.key === 'Enter') {
        ipc.send(IPC_CHANNELS.TERMINAL_WRITE, { terminalId, data: '\n' });
      } else if (e.key === 'Backspace') {
        ipc.send(IPC_CHANNELS.TERMINAL_WRITE, { terminalId, data: '\x7f' });
      } else if (e.key.length === 1) {
        ipc.send(IPC_CHANNELS.TERMINAL_WRITE, { terminalId, data: e.key });
      }
    },
    [terminalId],
  );

  return (
    <Stack h="100%" gap={0}>
      <Group
        h={36}
        px="md"
        justify="space-between"
        style={{ borderBottom: '1px solid var(--mantine-color-dark-5)', flexShrink: 0 }}
      >
        <Text size="xs" fw={600} c="dimmed">
          Terminal
        </Text>
        <Group gap={4}>
          <Tooltip label="New terminal">
            <ActionIcon variant="subtle" size="xs" color="gray" onClick={createNewTerminal}>
              <IconPlus size={12} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      <Box
        flex={1}
        style={{
          overflow: 'auto',
          background: '#0d1117',
          fontFamily: 'var(--mantine-font-family-monospace)',
          fontSize: 13,
          lineHeight: 1.5,
        }}
        p="sm"
        tabIndex={0}
        onKeyDown={handleInput}
      >
        <pre
          ref={outputRef}
          style={{
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            color: '#c9d1d9',
          }}
        >
          {output.join('')}
        </pre>
      </Box>
    </Stack>
  );
}
