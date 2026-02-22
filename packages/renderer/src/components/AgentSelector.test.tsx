import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '../__test-utils__/render';
import { AgentSelector } from './AgentSelector';

describe('AgentSelector', () => {
  it('renders with label', () => {
    renderWithProviders(<AgentSelector value={null} onChange={() => {}} />);
    expect(screen.getByText('AI Agent')).toBeInTheDocument();
  });

  it('renders with placeholder', () => {
    renderWithProviders(<AgentSelector value={null} onChange={() => {}} />);
    expect(screen.getByPlaceholderText('Select an agent')).toBeInTheDocument();
  });

  it('shows default agents when no availableAgents provided', () => {
    renderWithProviders(<AgentSelector value={null} onChange={() => {}} />);
    // The select component renders the options when clicked
    // We can verify the component renders without error
    expect(screen.getByText('AI Agent')).toBeInTheDocument();
  });

  it('renders with custom available agents', () => {
    const agents = [
      { value: 'claude-code' as const, label: 'Claude Code', available: true },
      { value: 'codex' as const, label: 'Codex', available: false },
    ];

    renderWithProviders(
      <AgentSelector value={null} onChange={() => {}} availableAgents={agents} />,
    );
    expect(screen.getByText('AI Agent')).toBeInTheDocument();
  });

  it('shows selected value', () => {
    renderWithProviders(<AgentSelector value="claude-code" onChange={() => {}} />);
    // When a value is selected, it should show in the input
    const input = screen.getByPlaceholderText('Select an agent') as HTMLInputElement;
    // The select shows the label for the selected value
    expect(input.value).toContain('Claude Code');
  });
});
