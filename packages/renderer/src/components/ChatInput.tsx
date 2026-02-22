import { useState, useRef, useCallback } from 'react';
import { Group, Textarea, ActionIcon, Tooltip, Box } from '@mantine/core';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled, placeholder }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue('');
  }, [value, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <Box
      p="md"
      style={{
        borderTop: '1px solid var(--mantine-color-dark-5)',
        flexShrink: 0,
      }}
    >
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.currentTarget.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || 'Type a message... (Cmd+Enter to send)'}
        disabled={disabled}
        autosize
        minRows={2}
        maxRows={8}
        styles={{
          input: {
            background: 'var(--mantine-color-dark-6)',
            border: '1px solid var(--mantine-color-dark-4)',
          },
        }}
      />
    </Box>
  );
}
