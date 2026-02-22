import { useState, useEffect, useCallback } from 'react';
import { Stack, Group, Tabs, Text, Box, Badge } from '@mantine/core';
import { ChatPanel } from './ChatPanel';
import { TerminalPanel } from './TerminalPanel';
import { GitStatusBar } from './GitStatusBar';
import { AgentStatusBadge } from './AgentStatusBadge';
import { ipc } from '../services/ipc';
import { IPC_CHANNELS } from '@maestro/shared';
import type { AgentStatus, Workspace, AgentType } from '@maestro/shared';

interface WorkspaceViewProps {
  workspace: Workspace;
}

export function WorkspaceView({ workspace }: WorkspaceViewProps) {
  const [activeTab, setActiveTab] = useState<string | null>('chat');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('idle');

  const handleSendPrompt = useCallback(
    async (prompt: string) => {
      if (!sessionId) {
        // Start a new session
        const result = await ipc.invoke<{ sessionId: string }>(IPC_CHANNELS.AGENT_START, {
          workspaceId: workspace.id,
          workspacePath: workspace.worktreePath || '',
          agentType: 'claude-code' as AgentType,
          opts: {},
        });
        setSessionId(result.sessionId);
        setAgentStatus('running');

        // Send the prompt after session starts
        await ipc.invoke(IPC_CHANNELS.AGENT_SEND, {
          sessionId: result.sessionId,
          prompt,
        });
      } else {
        await ipc.invoke(IPC_CHANNELS.AGENT_SEND, {
          sessionId,
          prompt,
        });
      }
    },
    [sessionId, workspace],
  );

  // Listen for status updates
  useEffect(() => {
    if (!sessionId) return;
    const unsub = ipc.on(IPC_CHANNELS.AGENT_STATUS, (data: unknown) => {
      const { sessionId: sid, status } = data as { sessionId: string; status: AgentStatus };
      if (sid === sessionId) {
        setAgentStatus(status);
      }
    });
    return unsub;
  }, [sessionId]);

  return (
    <Stack h="100%" gap={0}>
      {/* Workspace header */}
      <Group
        h={44}
        px="md"
        justify="space-between"
        style={{ borderBottom: '1px solid var(--mantine-color-dark-5)', flexShrink: 0 }}
      >
        <Group gap="sm">
          <Text size="sm" fw={600}>
            {workspace.name}
          </Text>
          <Badge size="xs" variant="outline" color="gray">
            {workspace.branchName}
          </Badge>
        </Group>
        <Group gap="xs">
          {sessionId && <AgentStatusBadge status={agentStatus} />}
          {workspace.prUrl && (
            <Badge size="xs" variant="light" color="blue">
              PR #{workspace.prNumber}
            </Badge>
          )}
        </Group>
      </Group>

      {/* Git status bar */}
      {workspace.worktreePath && <GitStatusBar workspacePath={workspace.worktreePath} />}

      {/* Tab content */}
      <Tabs value={activeTab} onChange={setActiveTab} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Tabs.List>
          <Tabs.Tab value="chat">Chat</Tabs.Tab>
          <Tabs.Tab value="terminal">Terminal</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="chat" style={{ flex: 1 }}>
          <ChatPanel
            sessionId={sessionId}
            agentStatus={agentStatus}
            onSend={handleSendPrompt}
          />
        </Tabs.Panel>

        <Tabs.Panel value="terminal" style={{ flex: 1 }}>
          {workspace.worktreePath ? (
            <TerminalPanel workspacePath={workspace.worktreePath} />
          ) : (
            <Stack align="center" justify="center" h="100%">
              <Text c="dimmed">No worktree path set</Text>
            </Stack>
          )}
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
