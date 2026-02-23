import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, act } from '../__test-utils__/render';
import { ChatPanel } from './ChatPanel';

describe('ChatPanel', () => {
  let onHandlers: Record<string, ((...args: unknown[]) => void)[]>;

  beforeEach(() => {
    vi.clearAllMocks();
    onHandlers = {};
    (window.maestro.invoke as any).mockResolvedValue([]);
    // Capture IPC event handlers so we can simulate events
    (window.maestro.on as any).mockImplementation((channel: string, cb: (...args: unknown[]) => void) => {
      if (!onHandlers[channel]) onHandlers[channel] = [];
      onHandlers[channel].push(cb);
      return () => {
        onHandlers[channel] = onHandlers[channel].filter((h) => h !== cb);
      };
    });
  });

  function fireEvent(channel: string, data: unknown) {
    for (const handler of onHandlers[channel] || []) {
      handler(data);
    }
  }

  it('renders the chat input area', () => {
    renderWithProviders(
      <ChatPanel sessionId={null} sessionIdRef={{ current: null }} agentStatus="idle" onSend={() => {}} />,
    );
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('loads message history when sessionId provided', async () => {
    (window.maestro.invoke as any).mockResolvedValue([
      { id: 1, sessionId: 's1', role: 'user', content: 'Hello from history', metadataJson: '{}', createdAt: '2024-01-01T00:00:00Z' },
    ]);

    renderWithProviders(
      <ChatPanel sessionId="s1" sessionIdRef={{ current: 's1' }} agentStatus="idle" onSend={() => {}} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Hello from history')).toBeInTheDocument();
    });
  });

  // ─── Bug 2 proof: sessionIdRef race condition fix ──────────────────

  describe('sessionIdRef race condition (Bug 2 fix)', () => {
    it('uses sessionIdRef for event filtering, not lagging sessionId prop', async () => {
      // Simulate the race: sessionIdRef is set synchronously by CenterPanel
      // BEFORE React re-renders ChatPanel with the new sessionId prop.
      const sessionIdRef = { current: null as string | null };

      const { rerender } = renderWithProviders(
        <ChatPanel sessionId={null} sessionIdRef={sessionIdRef} agentStatus="running" onSend={() => {}} />,
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
        <ChatPanel sessionId="session-A" sessionIdRef={sessionIdRef} agentStatus="running" onSend={() => {}} />,
      );

      act(() => {
        fireEvent('agent:output', {
          sessionId: 'session-OTHER',
          output: { type: 'text', content: 'wrong session text', timestamp: new Date().toISOString() },
        });
      });

      expect(screen.queryByText('wrong session text')).not.toBeInTheDocument();
    });

    it('accepts events once sessionIdRef is set even with null sessionId prop', async () => {
      const sessionIdRef = { current: 'session-fast' as string | null };

      renderWithProviders(
        <ChatPanel sessionId={null} sessionIdRef={sessionIdRef} agentStatus="running" onSend={() => {}} />,
      );

      act(() => {
        fireEvent('agent:output', {
          sessionId: 'session-fast',
          output: { type: 'text', content: 'streamed response', timestamp: new Date().toISOString() },
        });
      });

      await waitFor(() => {
        expect(screen.getByText('streamed response')).toBeInTheDocument();
      });
    });
  });
});
