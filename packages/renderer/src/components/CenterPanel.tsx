import { useState, useEffect, useCallback, useRef } from 'react';
import { Stack, Group, Text, Badge, ActionIcon, Select } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { ChatPanel } from './ChatPanel';
import { GitStatusBar } from './GitStatusBar';
import { AgentStatusBadge } from './AgentStatusBadge';
import { WorkspaceHeaderMenu } from './WorkspaceHeaderMenu';
import { CheckpointsDrawer } from './CheckpointsDrawer';
import { TodosDrawer } from './TodosDrawer';
import { PRDrawer } from './PRDrawer';
import { IssueLinker } from './IssueLinker';
import { IconPlayerStop } from './Icons';
import { useAppStore } from '../stores/appStore';
import { ipc } from '../services/ipc';
import { IPC_CHANNELS, WORKSPACE_STATUSES } from '@maestro/shared';
import type { AgentStatus, Workspace, Project, WorkspaceStatus } from '@maestro/shared';

interface CenterPanelProps {
  workspace: Workspace;
  project: Project;
  onDeleteWorkspace: (id: string) => void;
}

export function CenterPanel({ workspace, project, onDeleteWorkspace }: CenterPanelProps) {
  const updateWorkspace = useAppStore((s) => s.updateWorkspace);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('idle');
  const [checkpointsOpen, { open: openCheckpoints, close: closeCheckpoints }] = useDisclosure(false);
  const [todosOpen, { open: openTodos, close: closeTodos }] = useDisclosure(false);
  const [prOpen, { open: openPR, close: closePR }] = useDisclosure(false);
  const [issueLinkerOpen, { open: openIssueLinker, close: closeIssueLinker }] = useDisclosure(false);
  const [statusPickerOpen, { open: openStatusPicker, close: closeStatusPicker }] = useDisclosure(false);

  const sessionIdRef = useRef<string | null>(null);
  const statusUnsubRef = useRef<(() => void) | null>(null);

  const handleSendPrompt = useCallback(
    async (prompt: string): Promise<void> => {
      try {
        if (!sessionIdRef.current) {
          if (statusUnsubRef.current) {
            statusUnsubRef.current();
          }
          statusUnsubRef.current = ipc.on(IPC_CHANNELS.AGENT_STATUS, (data: unknown) => {
            const { sessionId: sid, status } = data as { sessionId: string; status: AgentStatus };
            if (sid === sessionIdRef.current) {
              setAgentStatus(status);
            }
          });

          const result = await ipc.invoke<{ sessionId: string }>(IPC_CHANNELS.AGENT_START, {
            workspaceId: workspace.id,
            workspacePath: workspace.worktreePath || '',
            agentType: workspace.agentType,
            opts: {},
          });
          sessionIdRef.current = result.sessionId;
          setSessionId(result.sessionId);
          setAgentStatus('running');

          await ipc.invoke(IPC_CHANNELS.AGENT_SEND, {
            sessionId: result.sessionId,
            prompt,
          });
        } else {
          await ipc.invoke(IPC_CHANNELS.AGENT_SEND, {
            sessionId: sessionIdRef.current,
            prompt,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('handleSendPrompt failed:', err);
        setAgentStatus('error');
        notifications.show({
          title: 'Agent error',
          message,
          color: 'red',
          autoClose: 8000,
        });
        throw err;
      }
    },
    [workspace],
  );

  const handleStopAgent = useCallback(async () => {
    if (!sessionIdRef.current) return;
    await ipc.invoke(IPC_CHANNELS.AGENT_STOP, sessionIdRef.current);
    setAgentStatus('stopped');
  }, []);

  const handlePRCreated = useCallback(
    (result: { number: string; url: string }) => {
      updateWorkspace(workspace.id, {
        prNumber: result.number,
        prUrl: result.url,
        status: 'in_review',
      });
      notifications.show({
        title: 'Pull request created',
        message: result.url,
        color: 'green',
      });
    },
    [workspace.id, updateWorkspace],
  );

  const handleChangeStatus = useCallback(
    async (status: WorkspaceStatus) => {
      try {
        await ipc.invoke(IPC_CHANNELS.WORKSPACE_UPDATE_STATUS, { id: workspace.id, status });
        updateWorkspace(workspace.id, { status });
        closeStatusPicker();
      } catch (err) {
        notifications.show({
          title: 'Failed to update status',
          message: String(err),
          color: 'red',
        });
      }
    },
    [workspace.id, updateWorkspace, closeStatusPicker],
  );

  // Clean up status listener on unmount
  useEffect(() => {
    return () => {
      if (statusUnsubRef.current) {
        statusUnsubRef.current();
        statusUnsubRef.current = null;
      }
    };
  }, []);

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
          {workspace.prUrl && (
            <Badge size="xs" variant="light" color="blue">
              PR #{workspace.prNumber}
            </Badge>
          )}
          <WorkspaceHeaderMenu
            onOpenCheckpoints={openCheckpoints}
            onOpenTodos={openTodos}
            onOpenPR={openPR}
            onLinkIssue={openIssueLinker}
            onChangeStatus={openStatusPicker}
            onDelete={() => onDeleteWorkspace(workspace.id)}
            hasPR={!!workspace.prUrl}
            hasGitPlatform={!!project.gitPlatform}
          />
        </Group>
      </Group>

      {/* Git status bar */}
      {workspace.worktreePath && <GitStatusBar workspacePath={workspace.worktreePath} />}

      {/* Chat — always visible */}
      <ChatPanel
        sessionId={sessionId}
        agentStatus={agentStatus}
        onSend={handleSendPrompt}
        onStop={handleStopAgent}
      />

      {/* Status picker modal */}
      {statusPickerOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={closeStatusPicker}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: 300 }}>
            <Select
              label="Change workspace status"
              data={WORKSPACE_STATUSES.map((s) => ({ value: s, label: s.replace('_', ' ') }))}
              value={workspace.status}
              onChange={(val) => val && handleChangeStatus(val as WorkspaceStatus)}
              styles={{
                dropdown: { background: 'var(--mantine-color-dark-7)' },
              }}
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Drawers */}
      <CheckpointsDrawer
        opened={checkpointsOpen}
        onClose={closeCheckpoints}
        workspaceId={workspace.id}
        workspacePath={workspace.worktreePath}
      />
      <TodosDrawer
        opened={todosOpen}
        onClose={closeTodos}
        workspaceId={workspace.id}
      />
      <PRDrawer
        opened={prOpen}
        onClose={closePR}
        workspace={workspace}
        project={project}
        onPRCreated={handlePRCreated}
      />
      {project.gitPlatform && (
        <IssueLinker
          opened={issueLinkerOpen}
          onClose={closeIssueLinker}
          workspaceId={workspace.id}
          repoPath={project.path}
          platform={project.gitPlatform}
        />
      )}
    </Stack>
  );
}
