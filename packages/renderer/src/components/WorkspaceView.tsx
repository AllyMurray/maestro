import { useState, useEffect, useCallback } from 'react';
import { Stack, Group, Tabs, Text, Box, Badge, ActionIcon, Button, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { ChatPanel } from './ChatPanel';
import { TerminalPanel } from './TerminalPanel';
import { GitStatusBar } from './GitStatusBar';
import { DiffViewer } from './DiffViewer';
import { CheckpointTimeline } from './CheckpointTimeline';
import { TodoList } from './TodoList';
import { AgentStatusBadge } from './AgentStatusBadge';
import { PRCreator } from './PRCreator';
import { PRView } from './PRView';
import { IssueLinker } from './IssueLinker';
import { IconPlayerStop, IconLink } from './Icons';
import { useAppStore } from '../stores/appStore';
import { ipc } from '../services/ipc';
import { IPC_CHANNELS } from '@maestro/shared';
import type { AgentStatus, Workspace, AgentType, Project } from '@maestro/shared';

interface WorkspaceViewProps {
  workspace: Workspace;
  project: Project;
}

export function WorkspaceView({ workspace, project }: WorkspaceViewProps) {
  const activeWorkspaceTab = useAppStore((s) => s.activeWorkspaceTab);
  const setActiveWorkspaceTab = useAppStore((s) => s.setActiveWorkspaceTab);
  const updateWorkspace = useAppStore((s) => s.updateWorkspace);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('idle');
  const [prCreatorOpen, { open: openPRCreator, close: closePRCreator }] = useDisclosure(false);
  const [issueLinkerOpen, { open: openIssueLinker, close: closeIssueLinker }] = useDisclosure(false);

  const handleSendPrompt = useCallback(
    async (prompt: string) => {
      if (!sessionId) {
        const result = await ipc.invoke<{ sessionId: string }>(IPC_CHANNELS.AGENT_START, {
          workspaceId: workspace.id,
          workspacePath: workspace.worktreePath || '',
          agentType: workspace.agentType,
          opts: {},
        });
        setSessionId(result.sessionId);
        setAgentStatus('running');

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

  const handleStopAgent = useCallback(async () => {
    if (!sessionId) return;
    await ipc.invoke(IPC_CHANNELS.AGENT_STOP, sessionId);
    setAgentStatus('stopped');
  }, [sessionId]);

  const handlePRCreated = useCallback(
    (result: { number: string; url: string }) => {
      updateWorkspace(workspace.id, { prNumber: result.number, prUrl: result.url });
      notifications.show({
        title: 'Pull request created',
        message: result.url,
        color: 'green',
      });
    },
    [workspace.id, updateWorkspace],
  );

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

  const isAgentActive = agentStatus === 'running' || agentStatus === 'waiting';

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
          {sessionId && isAgentActive && (
            <ActionIcon
              variant="subtle"
              color="red"
              size="sm"
              aria-label="Stop agent"
              onClick={handleStopAgent}
            >
              <IconPlayerStop size={14} />
            </ActionIcon>
          )}
          {sessionId && <AgentStatusBadge status={agentStatus} />}
          {project.gitPlatform && (
            <Tooltip label="Link issue">
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                aria-label="Link issue"
                onClick={openIssueLinker}
              >
                <IconLink size={14} />
              </ActionIcon>
            </Tooltip>
          )}
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
      <Tabs value={activeWorkspaceTab} onChange={setActiveWorkspaceTab} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Tabs.List>
          <Tabs.Tab value="chat">Chat</Tabs.Tab>
          <Tabs.Tab value="terminal">Terminal</Tabs.Tab>
          <Tabs.Tab value="diff">Diff</Tabs.Tab>
          <Tabs.Tab value="checkpoints">Checkpoints</Tabs.Tab>
          <Tabs.Tab value="todos">Todos</Tabs.Tab>
          <Tabs.Tab value="pr">{workspace.prUrl ? 'PR' : 'Create PR'}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="chat" style={{ flex: 1 }}>
          <ChatPanel
            sessionId={sessionId}
            agentStatus={agentStatus}
            onSend={handleSendPrompt}
            onStop={handleStopAgent}
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

        <Tabs.Panel value="diff" style={{ flex: 1 }}>
          {workspace.worktreePath ? (
            <DiffViewer workspacePath={workspace.worktreePath} />
          ) : (
            <Stack align="center" justify="center" h="100%">
              <Text c="dimmed">No worktree path set</Text>
            </Stack>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="checkpoints" style={{ flex: 1, overflow: 'auto' }}>
          {workspace.worktreePath ? (
            <CheckpointTimeline
              workspaceId={workspace.id}
              workspacePath={workspace.worktreePath}
            />
          ) : (
            <Stack align="center" justify="center" h="100%">
              <Text c="dimmed">No worktree path set</Text>
            </Stack>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="todos" style={{ flex: 1, overflow: 'auto' }}>
          <TodoList workspaceId={workspace.id} />
        </Tabs.Panel>

        <Tabs.Panel value="pr" style={{ flex: 1, overflow: 'auto' }}>
          {workspace.prUrl && workspace.prNumber && project.gitPlatform ? (
            <PRView repoPath={project.path} platform={project.gitPlatform} prId={workspace.prNumber} />
          ) : project.gitPlatform ? (
            <Stack align="center" justify="center" h="100%" gap="md">
              <Text c="dimmed">No pull request yet</Text>
              <Button onClick={openPRCreator}>Create Pull Request</Button>
            </Stack>
          ) : (
            <Stack align="center" justify="center" h="100%">
              <Text c="dimmed">No git platform detected</Text>
            </Stack>
          )}
        </Tabs.Panel>
      </Tabs>

      {/* Modals */}
      {project.gitPlatform && (
        <>
          <PRCreator
            opened={prCreatorOpen}
            onClose={closePRCreator}
            workspaceId={workspace.id}
            repoPath={project.path}
            platform={project.gitPlatform}
            headBranch={workspace.branchName}
            targetBranch={workspace.targetBranch}
            onCreated={handlePRCreated}
          />
          <IssueLinker
            opened={issueLinkerOpen}
            onClose={closeIssueLinker}
            workspaceId={workspace.id}
            repoPath={project.path}
            platform={project.gitPlatform}
          />
        </>
      )}
    </Stack>
  );
}
