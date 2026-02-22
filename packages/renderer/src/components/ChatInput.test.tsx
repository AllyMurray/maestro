import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '../__test-utils__/render';
import { ChatInput } from './ChatInput';

describe('ChatInput', () => {
  it('renders textarea with default placeholder', () => {
    renderWithProviders(<ChatInput onSend={() => {}} />);
    expect(screen.getByPlaceholderText(/Type a message/)).toBeInTheDocument();
  });

  it('renders custom placeholder', () => {
    renderWithProviders(<ChatInput onSend={() => {}} placeholder="Custom placeholder" />);
    expect(screen.getByPlaceholderText('Custom placeholder')).toBeInTheDocument();
  });

  it('disables textarea when disabled prop is true', () => {
    renderWithProviders(<ChatInput onSend={() => {}} disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('calls onSend with trimmed text on Cmd+Enter', async () => {
    const onSend = vi.fn();
    renderWithProviders(<ChatInput onSend={onSend} />);

    const textarea = screen.getByRole('textbox');
    await userEvent.click(textarea);
    await userEvent.type(textarea, '  Hello world  ');

    // Simulate Cmd+Enter
    await userEvent.keyboard('{Meta>}{Enter}{/Meta}');

    expect(onSend).toHaveBeenCalledWith('Hello world');
  });

  it('does not send empty messages', async () => {
    const onSend = vi.fn();
    renderWithProviders(<ChatInput onSend={onSend} />);

    const textarea = screen.getByRole('textbox');
    await userEvent.click(textarea);
    await userEvent.keyboard('{Meta>}{Enter}{/Meta}');

    expect(onSend).not.toHaveBeenCalled();
  });

  it('clears input after sending', async () => {
    const onSend = vi.fn();
    renderWithProviders(<ChatInput onSend={onSend} />);

    const textarea = screen.getByRole('textbox');
    await userEvent.click(textarea);
    await userEvent.type(textarea, 'Test message');
    await userEvent.keyboard('{Meta>}{Enter}{/Meta}');

    expect(textarea).toHaveValue('');
  });

  it('does not send on plain Enter (allows newlines)', async () => {
    const onSend = vi.fn();
    renderWithProviders(<ChatInput onSend={onSend} />);

    const textarea = screen.getByRole('textbox');
    await userEvent.click(textarea);
    await userEvent.type(textarea, 'Test');
    await userEvent.keyboard('{Enter}');

    expect(onSend).not.toHaveBeenCalled();
  });
});
