import { useEffect, useRef, useState, useCallback } from 'react';
import { ActionIcon, Tooltip } from '@mantine/core';
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
  const creatingRef = useRef(false);
  const dataUnsubRef = useRef<(() => void) | null>(null);

  const createNewTerminal = useCallback(async () => {
    // Clean up previous terminal
    if (terminalIdRef.current) {
      ipc.invoke(IPC_CHANNELS.TERMINAL_CLOSE, terminalIdRef.current);
    }
    if (dataUnsubRef.current) {
      dataUnsubRef.current();
      dataUnsubRef.current = null;
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

    // Register data listener BEFORE creating the backend terminal
    // so we don't miss the initial shell prompt.
    // Accept data optimistically while creating (terminalIdRef is still null).
    creatingRef.current = true;
    dataUnsubRef.current = ipc.on(IPC_CHANNELS.TERMINAL_DATA, (payload: unknown) => {
      const { terminalId: tid, data } = payload as { terminalId: string; data: string };
      if ((creatingRef.current || tid === terminalIdRef.current) && xtermRef.current) {
        xtermRef.current.write(data);
      }
    });

    try {
      // Create backend terminal with xterm's dimensions
      const result = await ipc.invoke<{ id: string }>(IPC_CHANNELS.TERMINAL_CREATE, {
        workspacePath,
        cols: xterm.cols,
        rows: xterm.rows,
      });

      const newId = result.id;
      terminalIdRef.current = newId;
      creatingRef.current = false;
      setTerminalId(newId);
    } catch (err) {
      console.error('Failed to create terminal:', err);
      xterm.write(`\r\nError creating terminal: ${err}\r\n`);
      return;
    }

    // Send user input to backend
    xterm.onData((data: string) => {
      ipc.send(IPC_CHANNELS.TERMINAL_WRITE, { terminalId: terminalIdRef.current!, data });
    });

    // Send resize events to backend
    xterm.onResize(({ cols, rows }: { cols: number; rows: number }) => {
      ipc.send(IPC_CHANNELS.TERMINAL_RESIZE, { terminalId: terminalIdRef.current!, cols, rows });
    });

    xterm.focus();
  }, [workspacePath]);

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
      if (dataUnsubRef.current) {
        dataUnsubRef.current();
        dataUnsubRef.current = null;
      }
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
    <div style={{ height: '100%', position: 'relative' }}>
      <div
        ref={termRef}
        style={{
          height: '100%',
          overflow: 'hidden',
          background: '#0d1117',
          padding: '4px',
        }}
      />
      <Tooltip label="New terminal">
        <ActionIcon
          variant="subtle"
          size="xs"
          color="gray"
          onClick={createNewTerminal}
          style={{ position: 'absolute', top: 4, right: 4, zIndex: 1 }}
        >
          <IconPlus size={12} />
        </ActionIcon>
      </Tooltip>
    </div>
  );
}
