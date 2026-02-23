import { useRef, useEffect, useState, useCallback } from 'react';
import { Stack, Paper, Text, ScrollArea, Box, Group, Loader, Code } from '@mantine/core';
import { ChatInput } from './ChatInput';
import { ipc } from '../services/ipc';
import { IPC_CHANNELS } from '@maestro/shared';
import type { AgentOutput, AgentStatus, Message } from '@maestro/shared';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool_call' | 'tool_result' | 'error';
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

interface ChatPanelProps {
  sessionId: string | null;
  sessionIdRef: React.RefObject<string | null>;
  agentStatus: AgentStatus;
  onSend: (prompt: string) => void | Promise<void>;
  onStop?: () => void;
}

export function ChatPanel({
  sessionId,
  sessionIdRef,
  agentStatus,
  onSend,
  onStop,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamBuffer, setStreamBuffer] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageSeqRef = useRef(0);
  const seenOutputRef = useRef<Map<string, number>>(new Map());
  const lastSessionIdRef = useRef<string | null>(sessionId);
  const isRunning = agentStatus === 'running';

  const nextMessageId = useCallback((prefix: ChatMessage['role']) => {
    messageSeqRef.current += 1;
    return `${prefix}-${Date.now()}-${messageSeqRef.current}`;
  }, []);

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === msg.role && last.content === msg.content) {
        return prev;
      }
      return [...prev, msg];
    });
  }, []);

  const seenOutput = useCallback((output: AgentOutput): boolean => {
    const outputKey = `${output.type}|${String(output.metadata?.toolName || '')}|${output.content}`;
    const now = Date.now();
    const lastSeen = seenOutputRef.current.get(outputKey);
    if (typeof lastSeen === 'number' && now - lastSeen < 3000) {
      return true;
    }
    seenOutputRef.current.set(outputKey, now);
    if (seenOutputRef.current.size > 500) {
      const first = seenOutputRef.current.keys().next().value;
      if (first) seenOutputRef.current.delete(first);
    }
    return false;
  }, []);

  const handleSend = useCallback(
    (text: string) => {
      addMessage({
        id: nextMessageId('user'),
        role: 'user',
        content: text,
        timestamp: new Date().toISOString(),
      });
      setStreamBuffer('');
      Promise.resolve(onSend(text)).catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        addMessage({
          id: nextMessageId('error'),
          role: 'error',
          content: `Failed to send: ${message}`,
          timestamp: new Date().toISOString(),
        });
      });
    },
    [addMessage, nextMessageId, onSend],
  );

  // Listen for agent output via IPC — registered once on mount, uses ref for session filtering
  useEffect(() => {
    if (!window.maestro) return;

    const unsubOutput = window.maestro.on('agent:output', (data: unknown) => {
      const { sessionId: sid, output } = data as {
        sessionId: string;
        output: AgentOutput;
      };
      if (!sessionIdRef.current || sid !== sessionIdRef.current) return;
      if (seenOutput(output)) return;

      switch (output.type) {
        case 'text':
          setStreamBuffer((prev) => prev + output.content);
          break;
        case 'tool_call':
          // Flush buffer as message
          setStreamBuffer((prev) => {
            if (prev) {
              addMessage({
                id: nextMessageId('assistant'),
                role: 'assistant',
                content: prev,
                timestamp: output.timestamp,
              });
            }
            return '';
          });
          addMessage({
            id: nextMessageId('tool_call'),
            role: 'tool_call',
            content: output.content,
            metadata: output.metadata,
            timestamp: output.timestamp,
          });
          break;
        case 'tool_result':
          addMessage({
            id: nextMessageId('tool_result'),
            role: 'tool_result',
            content: output.content,
            metadata: output.metadata,
            timestamp: output.timestamp,
          });
          break;
        case 'error':
          addMessage({
            id: nextMessageId('error'),
            role: 'error',
            content: output.content,
            timestamp: output.timestamp,
          });
          break;
      }
    });

    const unsubStatus = window.maestro.on('agent:status', (data: unknown) => {
      const { sessionId: sid, status } = data as { sessionId: string; status: AgentStatus };
      if (!sessionIdRef.current || sid !== sessionIdRef.current) return;

      // When agent finishes, flush buffer
      if (status === 'waiting' || status === 'stopped') {
        setStreamBuffer((prev) => {
          if (prev) {
            addMessage({
              id: nextMessageId('assistant'),
              role: 'assistant',
              content: prev,
              timestamp: new Date().toISOString(),
            });
          }
          return '';
        });
      }
    });

    return () => {
      unsubOutput();
      unsubStatus();
    };
  }, [addMessage, nextMessageId, seenOutput]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const prevSessionId = lastSessionIdRef.current;
    if (prevSessionId === sessionId) return;

    seenOutputRef.current.clear();
    if (sessionId === null || (prevSessionId && sessionId && prevSessionId !== sessionId)) {
      setMessages([]);
      setStreamBuffer('');
    }

    lastSessionIdRef.current = sessionId;
  }, [sessionId]);

  // Load message history when sessionId changes
  useEffect(() => {
    if (!sessionId) return;
    if (messages.length > 0) return;
    if (agentStatus === 'running' || agentStatus === 'waiting') return;
    ipc
      .invoke<Message[]>(IPC_CHANNELS.MESSAGE_LIST, sessionId)
      .then((history) => {
        if (history && history.length > 0) {
          const restored: ChatMessage[] = history.map((m) => ({
            id: `history-${m.id}`,
            role:
              m.role === 'user'
                ? 'user'
                : m.role === 'assistant'
                  ? 'assistant'
                  : m.role === 'tool_call'
                    ? 'tool_call'
                    : 'tool_result',
            content: m.content,
            metadata: m.metadataJson ? JSON.parse(m.metadataJson) : undefined,
            timestamp: m.createdAt,
          }));
          setMessages(restored);
        }
      })
      .catch(() => {});
  }, [agentStatus, messages.length, sessionId]);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamBuffer]);

  return (
    <Stack h="100%" gap={0}>
      {/* Messages area */}
      <ScrollArea flex={1} viewportRef={scrollRef} p="md">
        <Stack gap="sm">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {streamBuffer && (
            <MessageBubble
              message={{
                id: 'stream',
                role: 'assistant',
                content: streamBuffer,
                timestamp: new Date().toISOString(),
              }}
            />
          )}
          {isRunning && !streamBuffer && messages.length > 0 && (
            <Group gap="xs" c="dimmed">
              <Loader size="xs" />
              <Text size="xs">Thinking...</Text>
            </Group>
          )}
        </Stack>
      </ScrollArea>

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={isRunning} />
    </Stack>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const isError = message.role === 'error';
  const isTool = message.role === 'tool_call' || message.role === 'tool_result';

  if (isTool) {
    const toolName = (message.metadata?.toolName as string) || 'Tool';
    return (
      <Paper
        p="xs"
        bg="dark.6"
        radius="sm"
        style={{ borderLeft: '3px solid var(--mantine-color-violet-6)' }}
      >
        <Text size="xs" fw={600} c="violet.4" mb={4}>
          {message.role === 'tool_call' ? `Tool: ${toolName}` : `Result: ${toolName}`}
        </Text>
        <Code block style={{ fontSize: 11, maxHeight: 200, overflow: 'auto' }}>
          {message.content}
        </Code>
      </Paper>
    );
  }

  return (
    <Box
      style={{
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '85%',
      }}
    >
      <Paper p="sm" radius="md" bg={isUser ? 'brand.8' : isError ? 'red.9' : 'dark.6'}>
        <Text size="sm" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {message.content}
        </Text>
      </Paper>
    </Box>
  );
}
