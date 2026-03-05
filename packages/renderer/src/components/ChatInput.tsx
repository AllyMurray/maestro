import { useState, useRef, useCallback } from 'react';
import { Group, Textarea, ActionIcon, Tooltip, Box, Select, Switch } from '@mantine/core';
import { IconArrowUp } from './Icons';

interface ModelOption {
  value: string;
  label: string;
}

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  modelOptions?: ModelOption[];
  selectedModel?: string;
  thinkingEnabled?: boolean;
  planEnabled?: boolean;
  onModelChange?: (value: string) => void;
  onThinkingChange?: (value: boolean) => void;
  onPlanChange?: (value: boolean) => void;
}

export function ChatInput({
  onSend,
  disabled,
  placeholder,
  modelOptions,
  selectedModel = 'default',
  thinkingEnabled = false,
  planEnabled = false,
  onModelChange,
  onThinkingChange,
  onPlanChange,
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSend = !disabled && value.trim().length > 0;

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
      <Group align="flex-end" gap="xs" wrap="nowrap">
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
          style={{ flex: 1 }}
          styles={{
            input: {
              background: 'var(--mantine-color-dark-6)',
              border: '1px solid var(--mantine-color-dark-4)',
            },
          }}
        />
        <Tooltip label="Send (Cmd+Enter)">
          <ActionIcon
            aria-label="Send message"
            onClick={handleSend}
            disabled={!canSend}
            variant="filled"
            color="blue"
            mb={4}
          >
            <IconArrowUp size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
      {(modelOptions || onThinkingChange || onPlanChange) && (
        <Group mt="xs" justify="space-between" align="center" wrap="wrap" gap="xs">
          <Group gap="xs" wrap="wrap">
            {modelOptions && modelOptions.length > 0 && (
              <Select
                size="xs"
                aria-label="Model"
                data={modelOptions}
                value={selectedModel}
                onChange={(next) => onModelChange?.(next || 'default')}
                w={220}
                disabled={disabled}
              />
            )}
            {onThinkingChange && (
              <Switch
                size="xs"
                label="Thinking"
                checked={thinkingEnabled}
                onChange={(event) => onThinkingChange(event.currentTarget.checked)}
                disabled={disabled}
              />
            )}
            {onPlanChange && (
              <Switch
                size="xs"
                label="Plan"
                checked={planEnabled}
                onChange={(event) => onPlanChange(event.currentTarget.checked)}
                disabled={disabled}
              />
            )}
          </Group>
        </Group>
      )}
    </Box>
  );
}
