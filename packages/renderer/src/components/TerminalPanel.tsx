import { useEffect, useRef, useState, useCallback } from 'react';
import { Stack, Group, Text, ActionIcon, Tooltip } from '@mantine/core';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { IconPlus } from './Icons';
import { ipc } from '../services/ipc';
import { IPC_CHANNELS } from '@maestro/shared';

interface TerminalPanelProps {
  workspacePath: string;
}

export function TerminalPanel({ workspacePath }: TerminalPanelProps) {
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const terminalIdRef = useRef<string | null>(null);

  const createNewTerminal = useCallback(async () => {
    // Clean up previous terminal
    if (terminalIdRef.current) {
      ipc.invoke(IPC_CHANNELS.TERMINAL_CLOSE, terminalIdRef.current);
    }
    if (xtermRef.current) {
      xtermRef.current.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    }

    // Create xterm instance
    const xterm = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#c9d1d9',
        selectionBackground: '#264f78',
        black: '#0d1117',
        red: '#ff7b72',
        green: '#7ee787',
        yellow: '#d29922',
        blue: '#79c0ff',
        magenta: '#d2a8ff',
        cyan: '#a5d6ff',
        white: '#c9d1d9',
        brightBlack: '#484f58',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#a5d6ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#b3f0ff',
        brightWhite: '#f0f6fc',
      },
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    if (termRef.current) {
      xterm.open(termRef.current);
      fitAddon.fit();
    }

    // Create backend terminal with xterm's dimensions
    const result = await ipc.invoke<{ id: string }>(IPC_CHANNELS.TERMINAL_CREATE, {
      workspacePath,
      cols: xterm.cols,
      rows: xterm.rows,
    });

    const newId = result.id;
    setTerminalId(newId);
    terminalIdRef.current = newId;

    // Send user input to backend
    xterm.onData((data: string) => {
      ipc.send(IPC_CHANNELS.TERMINAL_WRITE, { terminalId: newId, data });
    });

    // Send resize events to backend
    xterm.onResize(({ cols, rows }: { cols: number; rows: number }) => {
      ipc.send(IPC_CHANNELS.TERMINAL_RESIZE, { terminalId: newId, cols, rows });
    });

    xterm.focus();
  }, [workspacePath]);

  // Listen for terminal data from backend
  useEffect(() => {
    if (!terminalId) return;
    const unsub = ipc.on(IPC_CHANNELS.TERMINAL_DATA, (payload: unknown) => {
      const { terminalId: tid, data } = payload as { terminalId: string; data: string };
      if (tid === terminalId && xtermRef.current) {
        xtermRef.current.write(data);
      }
    });
    return unsub;
  }, [terminalId]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (fitAddonRef.current) {
        try {
          fitAddonRef.current.fit();
        } catch {
          // ignore fit errors during transitions
        }
      }
    };

    const observer = new ResizeObserver(handleResize);
    if (termRef.current) {
      observer.observe(termRef.current);
    }

    return () => observer.disconnect();
  }, [terminalId]);

  // Create terminal on mount
  useEffect(() => {
    createNewTerminal();
    return () => {
      if (terminalIdRef.current) {
        ipc.invoke(IPC_CHANNELS.TERMINAL_CLOSE, terminalIdRef.current);
        terminalIdRef.current = null;
      }
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

      <div
        ref={termRef}
        style={{
          flex: 1,
          overflow: 'hidden',
          background: '#0d1117',
          padding: '4px',
        }}
      />
    </Stack>
  );
}
