import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '../__test-utils__/render';
import { ChatPanel } from './ChatPanel';

describe('ChatPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window.maestro.invoke as any).mockResolvedValue([]);
    (window.maestro.on as any).mockReturnValue(() => {});
  });

  it('renders Chat header', () => {
    renderWithProviders(
      <ChatPanel sessionId={null} agentStatus="idle" onSend={() => {}} />,
    );
    expect(screen.getByText('Chat')).toBeInTheDocument();
  });

  it('shows stop button when agent is running and onStop provided', () => {
    renderWithProviders(
      <ChatPanel sessionId="s1" agentStatus="running" onSend={() => {}} onStop={() => {}} />,
    );
    expect(screen.getByLabelText('Stop agent')).toBeInTheDocument();
  });

  it('hides stop button when agent is idle', () => {
    renderWithProviders(
      <ChatPanel sessionId="s1" agentStatus="idle" onSend={() => {}} onStop={() => {}} />,
    );
    expect(screen.queryByLabelText('Stop agent')).not.toBeInTheDocument();
  });

  it('hides stop button when onStop not provided', () => {
    renderWithProviders(
      <ChatPanel sessionId="s1" agentStatus="running" onSend={() => {}} />,
    );
    expect(screen.queryByLabelText('Stop agent')).not.toBeInTheDocument();
  });

  it('calls onStop when stop button clicked', async () => {
    const onStop = vi.fn();
    renderWithProviders(
      <ChatPanel sessionId="s1" agentStatus="running" onSend={() => {}} onStop={onStop} />,
    );

    await userEvent.click(screen.getByLabelText('Stop agent'));
    expect(onStop).toHaveBeenCalledOnce();
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
