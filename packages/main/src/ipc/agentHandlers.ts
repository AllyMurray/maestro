import { IpcMain, BrowserWindow, WebContents } from 'electron';
import { IPC_CHANNELS, AgentType, AgentOpts, AgentOutput } from '@maestro/shared';
import {
  createAgentManager,
  getActiveManager,
  registerManager,
  unregisterManager,
  discoverAgents,
} from '../services/agents';
import {
  createSession,
  updateSessionStatus,
  setAgentSessionId,
  addMessage,
} from '../services/sessionManager';
import { createCheckpoint } from '../services/checkpointManager';
import { getDb } from '../database/db';
import { getConfig } from '../services/configManager';
import { logger } from '../services/logger';

const API_KEY_CONFIG: Record<AgentType, string> = {
  'claude-code': 'anthropic_api_key',
  codex: 'openai_api_key',
  cursor: 'cursor_api_key',
};

function resolveOpts(agentType: AgentType, opts: AgentOpts): AgentOpts {
  const resolved = { ...opts };
  if (!resolved.apiKey) {
    const configKey = API_KEY_CONFIG[agentType];
    const stored = configKey ? getConfig(configKey) : null;
    if (stored) resolved.apiKey = stored;
  }
  if (!resolved.model && agentType === 'claude-code') {
    const model = getConfig('claude_model');
    if (model) resolved.model = model;
  }
  return resolved;
}

function wireManagerEvents(
  manager: ReturnType<typeof createAgentManager>,
  sessionId: string,
  sender: WebContents | undefined,
): void {
  const window = sender ? BrowserWindow.fromWebContents(sender) : null;
  if (!window) {
    logger.error('Agent event wiring: BrowserWindow.fromWebContents returned null');
  }

  let pendingAssistantText = '';
  const flushPendingAssistantText = (): void => {
    if (!pendingAssistantText) return;
    addMessage(sessionId, 'assistant', pendingAssistantText);
    pendingAssistantText = '';
  };

  const persistOutput = (output: AgentOutput): void => {
    if (output.type === 'status') return;
    if (output.type === 'text') {
      pendingAssistantText += output.content;
      return;
    }

    flushPendingAssistantText();
    addMessage(sessionId, output.type, output.content, output.metadata);
  };

  manager.on('output', (output) => {
    logger.debug(`Forwarding agent output: type=${output.type}, sessionId=${sessionId}`);
    window?.webContents.send(IPC_CHANNELS.AGENT_OUTPUT, {
      sessionId,
      output,
    });
    persistOutput(output);
  });

  manager.on('status', (status) => {
    if (status === 'waiting' || status === 'stopped' || status === 'error') {
      flushPendingAssistantText();
    }
    updateSessionStatus(
      sessionId,
      status === 'waiting'
        ? 'waiting'
        : status === 'running'
          ? 'running'
          : status === 'error'
            ? 'error'
            : 'running',
    );
    window?.webContents.send(IPC_CHANNELS.AGENT_STATUS, {
      sessionId,
      status,
    });
  });

  manager.on('error', (err) => {
    flushPendingAssistantText();
    logger.error(`Agent error (${sessionId}):`, err.message);
    window?.webContents.send(IPC_CHANNELS.AGENT_OUTPUT, {
      sessionId,
      output: {
        type: 'error',
        content: err.message,
        timestamp: new Date().toISOString(),
      },
    });
  });

  manager.on('session_id', (agentSessionId) => {
    setAgentSessionId(sessionId, agentSessionId);
  });
}

export function registerAgentHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IPC_CHANNELS.AGENT_LIST_AVAILABLE, async () => {
    return discoverAgents();
  });

  ipcMain.handle(
    IPC_CHANNELS.AGENT_START,
    async (
      event,
      data: {
        workspaceId: string;
        workspacePath: string;
        agentType: AgentType;
        opts?: AgentOpts;
      },
    ) => {
      if (!data.workspacePath) {
        throw new Error('workspacePath is required to start an agent');
      }

      logger.info(`AGENT_START: workspaceId=${data.workspaceId}, agentType=${data.agentType}`);

      const availableAgents = await discoverAgents();
      const selectedAgent = availableAgents.find((a) => a.type === data.agentType);
      if (!selectedAgent?.available) {
        const reason = selectedAgent?.reason || 'Not installed';
        throw new Error(
          `${selectedAgent?.displayName || data.agentType} is unavailable: ${reason}`,
        );
      }

      const opts = resolveOpts(data.agentType, data.opts || {});
      const session = createSession(data.workspaceId, data.agentType, opts.model);
      const manager = createAgentManager(data.agentType);

      wireManagerEvents(manager, session.id, event.sender);

      registerManager(session.id, manager);
      await manager.start(data.workspacePath, opts);

      return { sessionId: session.id };
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_SEND,
    async (event, data: { sessionId: string; prompt: string }) => {
      const db = getDb();
      const sessionWorkspace = db
        .prepare(
          `SELECT
             s.workspace_id as workspace_id,
             s.agent_type as agent_type,
             s.model as model,
             s.agent_session_id as agent_session_id,
             w.worktree_path as worktree_path
           FROM sessions s
           JOIN workspaces w ON w.id = s.workspace_id
           WHERE s.id = ?`,
        )
        .get(data.sessionId) as
        | {
            workspace_id: string;
            agent_type: AgentType;
            model: string | null;
            agent_session_id: string | null;
            worktree_path: string | null;
          }
        | undefined;

      if (!sessionWorkspace) {
        throw new Error(`Session ${data.sessionId} not found`);
      }
      if (!sessionWorkspace.worktree_path) {
        throw new Error(`Workspace ${sessionWorkspace.workspace_id} has no worktree path`);
      }

      let manager = getActiveManager(data.sessionId);
      if (!manager) {
        logger.info(`Rehydrating agent manager for existing session ${data.sessionId}`);
        const opts = resolveOpts(sessionWorkspace.agent_type, {
          model: sessionWorkspace.model || undefined,
          resumeSessionId: sessionWorkspace.agent_session_id || undefined,
        });
        manager = createAgentManager(sessionWorkspace.agent_type);
        wireManagerEvents(manager, data.sessionId, event?.sender);
        registerManager(data.sessionId, manager);
        await manager.start(sessionWorkspace.worktree_path, opts);
      }

      const messageId = addMessage(data.sessionId, 'user', data.prompt);

      try {
        await createCheckpoint(
          sessionWorkspace.worktree_path,
          sessionWorkspace.workspace_id,
          data.sessionId,
          messageId,
        );
      } catch (err) {
        logger.warn(`Checkpoint creation failed for session ${data.sessionId}: ${String(err)}`);
      }

      await manager.send(data.prompt);
      return { success: true };
    },
  );

  ipcMain.handle(IPC_CHANNELS.AGENT_STOP, async (_event, sessionId: string) => {
    const manager = getActiveManager(sessionId);
    if (manager) {
      await manager.stop();
      unregisterManager(sessionId);
      updateSessionStatus(sessionId, 'completed');
    }
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.AGENT_STATUS, (_event, sessionId: string) => {
    const manager = getActiveManager(sessionId);
    return manager?.status || 'idle';
  });
}
