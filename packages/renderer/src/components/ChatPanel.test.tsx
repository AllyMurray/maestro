import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '../__test-utils__/render';
import { ChatPanel } from './ChatPanel';

describe('ChatPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window.maestro.invoke as any).mockResolvedValue([]);
    (window.maestro.on as any).mockReturnValue(() => {});
  });

  it('renders the chat input area', () => {
    renderWithProviders(
      <ChatPanel sessionId={null} agentStatus="idle" onSend={() => {}} />,
    );
    // Chat input should be present (textarea or input)
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('loads message history when sessionId provided', async () => {
    (window.maestro.invoke as any).mockResolvedValue([
      { id: 1, sessionId: 's1', role: 'user', content: 'Hello from history', metadataJson: '{}', createdAt: '2024-01-01T00:00:00Z' },
    ]);

    renderWithProviders(
      <ChatPanel sessionId="s1" agentStatus="idle" onSend={() => {}} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Hello from history')).toBeInTheDocument();
    });
  });
});
