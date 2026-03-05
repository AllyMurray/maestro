import { useState, useEffect, useCallback, useRef } from 'react';
import { Stack, Group, Text, Badge, ActionIcon, Select, Button } from '@mantine/core';
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
import { IconPlayerStop, IconArchive, IconGitBranch } from './Icons';
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
  const [checkpointsOpen, { open: openCheckpoints, close: closeCheckpoints }] =
    useDisclosure(false);
  const [todosOpen, { open: openTodos, close: closeTodos }] = useDisclosure(false);
  const [prOpen, { open: openPR, close: closePR }] = useDisclosure(false);
  const [issueLinkerOpen, { open: openIssueLinker, close: closeIssueLinker }] =
    useDisclosure(false);
  const [statusPickerOpen, { open: openStatusPicker, close: closeStatusPicker }] =
    useDisclosure(false);
  const [todoCount, setTodoCount] = useState(0);
  const [todoBlockerCount, setTodoBlockerCount] = useState(0);
  const [checkpointCount, setCheckpointCount] = useState(0);
  const [clearHistoryVersion, setClearHistoryVersion] = useState(0);

  const sessionIdRef = useRef<string | null>(null);
  const statusUnsubRef = useRef<(() => void) | null>(null);

  const attachStatusListener = useCallback(() => {
    if (statusUnsubRef.current) {
      statusUnsubRef.current();
    }
    statusUnsubRef.current = ipc.on(IPC_CHANNELS.AGENT_STATUS, (data: unknown) => {
      const { sessionId: sid, status } = data as { sessionId: string; status: AgentStatus };
      if (sid === sessionIdRef.current) {
        setAgentStatus(status);
      }
    });
  }, []);

  const handleSendPrompt = useCallback(
    async (prompt: string): Promise<void> => {
      try {
        if (!workspace.worktreePath) {
          notifications.show({
            title: 'Workspace not ready',
            message: 'No worktree path configured.',
            color: 'red',
          });
          return;
        }

        if (!sessionIdRef.current) {
          attachStatusListener();

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
    [attachStatusListener, workspace],
  );

  useEffect(() => {
    let cancelled = false;

    if (statusUnsubRef.current) {
      statusUnsubRef.current();
      statusUnsubRef.current = null;
    }
    sessionIdRef.current = null;
    setSessionId(null);
    setAgentStatus('idle');

    ipc
      .invoke<Array<{ id: string }>>(IPC_CHANNELS.SESSION_LIST, workspace.id)
      .then(async (sessions) => {
        if (cancelled) return;
        const latest = Array.isArray(sessions) && sessions.length > 0 ? sessions[0] : null;
        if (!latest?.id) return;

        sessionIdRef.current = latest.id;
        setSessionId(latest.id);
        attachStatusListener();

        try {
          const status = await ipc.invoke<AgentStatus>(IPC_CHANNELS.AGENT_STATUS, latest.id);
          if (!cancelled) {
            setAgentStatus(status);
          }
        } catch {
          if (!cancelled) {
            setAgentStatus('idle');
          }
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [attachStatusListener, workspace.id]);

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

  const loadTodoMeta = useCallback(async () => {
    try {
      const todos = await ipc.invoke<Array<{ isCompleted: boolean; blocksMerge: boolean }>>(
        IPC_CHANNELS.TODO_LIST,
        workspace.id,
      );
      const list = Array.isArray(todos) ? todos : [];
      setTodoCount(list.length);
      setTodoBlockerCount(list.filter((todo) => todo.blocksMerge && !todo.isCompleted).length);
    } catch {
      setTodoCount(0);
      setTodoBlockerCount(0);
    }
  }, [workspace.id]);

  const loadCheckpointMeta = useCallback(async () => {
    try {
      const checkpoints = await ipc.invoke<Array<unknown>>(
        IPC_CHANNELS.CHECKPOINT_LIST,
        workspace.id,
      );
      setCheckpointCount(Array.isArray(checkpoints) ? checkpoints.length : 0);
    } catch {
      setCheckpointCount(0);
    }
  }, [workspace.id]);

  const handleClearChatHistory = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid) {
      notifications.show({
        title: 'No chat to clear',
        message: 'Start a session first.',
        color: 'yellow',
      });
      return;
    }

    if (agentStatus === 'running' || agentStatus === 'waiting') {
      notifications.show({
        title: 'Agent is active',
        message: 'Stop the agent before clearing chat history.',
        color: 'yellow',
      });
      return;
    }

    if (!confirm('Clear chat history for this session?')) return;

    try {
      await ipc.invoke(IPC_CHANNELS.SESSION_CLEAR, sid);
      setClearHistoryVersion((v) => v + 1);
      notifications.show({
        title: 'Chat history cleared',
        message: 'This session is now empty.',
        color: 'green',
      });
      loadCheckpointMeta();
    } catch (err) {
      notifications.show({
        title: 'Failed to clear chat history',
        message: String(err),
        color: 'red',
      });
    }
  }, [agentStatus, loadCheckpointMeta]);

  useEffect(() => {
    const onClearHistory = () => {
      void handleClearChatHistory();
    };
    window.addEventListener('maestro:clear-chat-history', onClearHistory);
    return () => {
      window.removeEventListener('maestro:clear-chat-history', onClearHistory);
    };
  }, [handleClearChatHistory]);

  useEffect(() => {
    loadTodoMeta();
    loadCheckpointMeta();
    const interval = setInterval(() => {
      loadTodoMeta();
      loadCheckpointMeta();
    }, 10000);
    return () => clearInterval(interval);
  }, [loadTodoMeta, loadCheckpointMeta]);

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
          <Badge
            size="xs"
            variant="light"
            color={
              workspace.agentType === 'codex'
                ? 'green'
                : workspace.agentType === 'cursor'
                  ? 'violet'
                  : 'blue'
            }
          >
            {workspace.agentType === 'claude-code'
              ? 'Claude Code'
              : workspace.agentType === 'codex'
                ? 'Codex'
                : 'Cursor'}
          </Badge>
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
          <Button
            size="xs"
            variant="subtle"
            color="gray"
            leftSection={<IconArchive size={12} />}
            onClick={openTodos}
            aria-label="Open todos"
          >
            Todos
          </Button>
          <Badge size="xs" variant="light" color={todoBlockerCount > 0 ? 'red' : 'gray'}>
            {todoCount}
          </Badge>
          <Button
            size="xs"
            variant="subtle"
            color="gray"
            leftSection={<IconGitBranch size={12} />}
            onClick={openCheckpoints}
            aria-label="Open checkpoints"
          >
            Checkpoints
          </Button>
          <Badge size="xs" variant="light" color="gray">
            {checkpointCount}
          </Badge>
          <WorkspaceHeaderMenu
            onOpenCheckpoints={openCheckpoints}
            onOpenTodos={openTodos}
            onOpenPR={openPR}
            onLinkIssue={openIssueLinker}
            onClearHistory={handleClearChatHistory}
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
        sessionIdRef={sessionIdRef}
        agentStatus={agentStatus}
        clearHistoryVersion={clearHistoryVersion}
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
      <TodosDrawer opened={todosOpen} onClose={closeTodos} workspaceId={workspace.id} />
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
