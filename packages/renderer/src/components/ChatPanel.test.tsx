import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, act, userEvent } from '../__test-utils__/render';
import { ChatPanel } from './ChatPanel';

describe('ChatPanel', () => {
  let onHandlers: Record<string, ((...args: unknown[]) => void)[]>;

  beforeEach(() => {
    vi.clearAllMocks();
    onHandlers = {};
    (window.maestro.invoke as any).mockResolvedValue([]);
    // Capture IPC event handlers so we can simulate events
    (window.maestro.on as any).mockImplementation(
      (channel: string, cb: (...args: unknown[]) => void) => {
        if (!onHandlers[channel]) onHandlers[channel] = [];
        onHandlers[channel].push(cb);
        return () => {
          onHandlers[channel] = onHandlers[channel].filter((h) => h !== cb);
        };
      },
    );
  });

  function fireEvent(channel: string, data: unknown) {
    for (const handler of onHandlers[channel] || []) {
      handler(data);
    }
  }

  it('renders the chat input area', () => {
    renderWithProviders(
      <ChatPanel
        sessionId={null}
        sessionIdRef={{ current: null }}
        agentStatus="idle"
        onSend={() => {}}
      />,
    );
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('loads message history when sessionId provided', async () => {
    (window.maestro.invoke as any).mockResolvedValue([
      {
        id: 1,
        sessionId: 's1',
        role: 'user',
        content: 'Hello from history',
        metadataJson: '{}',
        createdAt: '2024-01-01T00:00:00Z',
      },
    ]);

    renderWithProviders(
      <ChatPanel
        sessionId="s1"
        sessionIdRef={{ current: 's1' }}
        agentStatus="idle"
        onSend={() => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Hello from history')).toBeInTheDocument();
    });
  });

  it('coalesces fragmented assistant history into one bubble', async () => {
    (window.maestro.invoke as any).mockResolvedValue([
      {
        id: 1,
        sessionId: 's1',
        role: 'assistant',
        content: 'Streamed ',
        metadataJson: '{}',
        createdAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 2,
        sessionId: 's1',
        role: 'assistant',
        content: 'message',
        metadataJson: '{}',
        createdAt: '2024-01-01T00:00:01Z',
      },
    ]);

    renderWithProviders(
      <ChatPanel
        sessionId="s1"
        sessionIdRef={{ current: 's1' }}
        agentStatus="idle"
        onSend={() => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Streamed message')).toBeInTheDocument();
    });
    expect(screen.queryByText('Streamed ')).not.toBeInTheDocument();
    expect(screen.queryByText('message')).not.toBeInTheDocument();
  });

  it('does not load history while agent is actively running', () => {
    renderWithProviders(
      <ChatPanel
        sessionId="s1"
        sessionIdRef={{ current: 's1' }}
        agentStatus="running"
        onSend={() => {}}
      />,
    );

    expect(window.maestro.invoke).not.toHaveBeenCalled();
  });

  it('keeps first user message when sessionId is created', async () => {
    const sessionIdRef = { current: null as string | null };
    const onSend = vi.fn().mockResolvedValue(undefined);

    const { rerender } = renderWithProviders(
      <ChatPanel sessionId={null} sessionIdRef={sessionIdRef} agentStatus="idle" onSend={onSend} />,
    );

    const textarea = screen.getByRole('textbox');
    await userEvent.click(textarea);
    await userEvent.type(textarea, 'hello first');
    await userEvent.keyboard('{Meta>}{Enter}{/Meta}');

    await waitFor(() => {
      expect(screen.getByText('hello first')).toBeInTheDocument();
    });

    sessionIdRef.current = 'session-1';
    rerender(
      <ChatPanel
        sessionId="session-1"
        sessionIdRef={sessionIdRef}
        agentStatus="running"
        onSend={onSend}
      />,
    );

    expect(screen.getByText('hello first')).toBeInTheDocument();
  });

  it('ignores duplicate agent output events', async () => {
    const sessionIdRef = { current: 'session-1' as string | null };
    const timestamp = new Date().toISOString();

    renderWithProviders(
      <ChatPanel
        sessionId="session-1"
        sessionIdRef={sessionIdRef}
        agentStatus="running"
        onSend={() => {}}
      />,
    );

    act(() => {
      fireEvent('agent:output', {
        sessionId: 'session-1',
        output: { type: 'error', content: 'duplicate event', timestamp },
      });
      fireEvent('agent:output', {
        sessionId: 'session-1',
        output: { type: 'error', content: 'duplicate event', timestamp },
      });
    });

    await waitFor(() => {
      expect(screen.getByText('duplicate event')).toBeInTheDocument();
    });
    expect(screen.getAllByText('duplicate event')).toHaveLength(1);
  });

  it('ignores near-duplicate outputs with different timestamps', async () => {
    const sessionIdRef = { current: 'session-1' as string | null };

    renderWithProviders(
      <ChatPanel
        sessionId="session-1"
        sessionIdRef={sessionIdRef}
        agentStatus="running"
        onSend={() => {}}
      />,
    );

    act(() => {
      fireEvent('agent:output', {
        sessionId: 'session-1',
        output: {
          type: 'text',
          content: 'same assistant line',
          timestamp: new Date('2026-02-23T18:03:46.100Z').toISOString(),
        },
      });
      fireEvent('agent:output', {
        sessionId: 'session-1',
        output: {
          type: 'text',
          content: 'same assistant line',
          timestamp: new Date('2026-02-23T18:03:46.900Z').toISOString(),
        },
      });
      fireEvent('agent:status', {
        sessionId: 'session-1',
        status: 'waiting',
      });
    });

    await waitFor(() => {
      expect(screen.getByText('same assistant line')).toBeInTheDocument();
    });
    expect(screen.getAllByText('same assistant line')).toHaveLength(1);
  });

  it('does not emit duplicate React keys when Date.now collides', async () => {
    const sessionIdRef = { current: 'session-1' as string | null };
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1771869307165);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderWithProviders(
      <ChatPanel
        sessionId="session-1"
        sessionIdRef={sessionIdRef}
        agentStatus="running"
        onSend={() => {}}
      />,
    );

    act(() => {
      fireEvent('agent:output', {
        sessionId: 'session-1',
        output: {
          type: 'tool_call',
          content: '{"name":"Read","id":"tool-1"}',
          metadata: { toolName: 'Read' },
          timestamp: new Date().toISOString(),
        },
      });
      fireEvent('agent:output', {
        sessionId: 'session-1',
        output: {
          type: 'tool_result',
          content: 'first result',
          metadata: { toolName: 'Read' },
          timestamp: new Date().toISOString(),
        },
      });
      fireEvent('agent:output', {
        sessionId: 'session-1',
        output: {
          type: 'tool_call',
          content: '{"name":"Read","id":"tool-2"}',
          metadata: { toolName: 'Read' },
          timestamp: new Date().toISOString(),
        },
      });
      fireEvent('agent:output', {
        sessionId: 'session-1',
        output: {
          type: 'tool_result',
          content: 'second result',
          metadata: { toolName: 'Read' },
          timestamp: new Date().toISOString(),
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText('first result')).toBeInTheDocument();
      expect(screen.getByText('second result')).toBeInTheDocument();
    });

    const duplicateKeyCalls = errorSpy.mock.calls.filter((call) =>
      String(call[0]).includes('Encountered two children with the same key'),
    );
    expect(duplicateKeyCalls).toHaveLength(0);

    nowSpy.mockRestore();
    errorSpy.mockRestore();
  });

  // ─── Bug 2 proof: sessionIdRef race condition fix ──────────────────

  describe('sessionIdRef race condition (Bug 2 fix)', () => {
    it('uses sessionIdRef for event filtering, not lagging sessionId prop', async () => {
      // Simulate the race: sessionIdRef is set synchronously by CenterPanel
      // BEFORE React re-renders ChatPanel with the new sessionId prop.
      const sessionIdRef = { current: null as string | null };

      const { rerender } = renderWithProviders(
        <ChatPanel
          sessionId={null}
          sessionIdRef={sessionIdRef}
          agentStatus="running"
          onSend={() => {}}
        />,
      );

      // CenterPanel sets the ref synchronously (before React re-renders)
      sessionIdRef.current = 'session-123';

      // Simulate an error event arriving BEFORE React has re-rendered with new sessionId prop
      // (sessionId prop is still null, but sessionIdRef.current is already 'session-123')
      act(() => {
        fireEvent('agent:output', {
          sessionId: 'session-123',
          output: { type: 'error', content: 'spawn ENOENT', timestamp: new Date().toISOString() },
        });
      });

      // The error should be displayed — it was NOT dropped
      await waitFor(() => {
        expect(screen.getByText('spawn ENOENT')).toBeInTheDocument();
      });
    });

    it('drops events for a different sessionId', () => {
      const sessionIdRef = { current: 'session-A' };

      renderWithProviders(
        <ChatPanel
          sessionId="session-A"
          sessionIdRef={sessionIdRef}
          agentStatus="running"
          onSend={() => {}}
        />,
      );

      act(() => {
        fireEvent('agent:output', {
          sessionId: 'session-OTHER',
          output: {
            type: 'text',
            content: 'wrong session text',
            timestamp: new Date().toISOString(),
          },
        });
      });

      expect(screen.queryByText('wrong session text')).not.toBeInTheDocument();
    });

    it('accepts events once sessionIdRef is set even with null sessionId prop', async () => {
      const sessionIdRef = { current: 'session-fast' as string | null };

      renderWithProviders(
        <ChatPanel
          sessionId={null}
          sessionIdRef={sessionIdRef}
          agentStatus="running"
          onSend={() => {}}
        />,
      );

      act(() => {
        fireEvent('agent:output', {
          sessionId: 'session-fast',
          output: {
            type: 'text',
            content: 'streamed response',
            timestamp: new Date().toISOString(),
          },
        });
      });

      await waitFor(() => {
        expect(screen.getByText('streamed response')).toBeInTheDocument();
      });
    });
  });
});
