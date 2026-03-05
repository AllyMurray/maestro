import { IpcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS, AgentType, AgentOpts } from '@maestro/shared';
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

      // Wire up events
      const window = BrowserWindow.fromWebContents(event.sender);
      if (!window) {
        logger.error('AGENT_START: BrowserWindow.fromWebContents returned null');
      }

      manager.on('output', (output) => {
        logger.debug(`Forwarding agent output: type=${output.type}, sessionId=${session.id}`);
        window?.webContents.send(IPC_CHANNELS.AGENT_OUTPUT, {
          sessionId: session.id,
          output,
        });
        if (output.type !== 'status') {
          addMessage(
            session.id,
            output.type === 'text' ? 'assistant' : output.type,
            output.content,
            output.metadata,
          );
        }
      });

      manager.on('status', (status) => {
        updateSessionStatus(
          session.id,
          status === 'waiting'
            ? 'waiting'
            : status === 'running'
              ? 'running'
              : status === 'error'
                ? 'error'
                : 'running',
        );
        window?.webContents.send(IPC_CHANNELS.AGENT_STATUS, {
          sessionId: session.id,
          status,
        });
      });

      manager.on('error', (err) => {
        logger.error(`Agent error (${session.id}):`, err.message);
        window?.webContents.send(IPC_CHANNELS.AGENT_OUTPUT, {
          sessionId: session.id,
          output: {
            type: 'error',
            content: err.message,
            timestamp: new Date().toISOString(),
          },
        });
      });

      manager.on('session_id', (agentSessionId) => {
        setAgentSessionId(session.id, agentSessionId);
      });

      registerManager(session.id, manager);
      await manager.start(data.workspacePath, opts);

      return { sessionId: session.id };
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_SEND,
    async (_event, data: { sessionId: string; prompt: string }) => {
      const manager = getActiveManager(data.sessionId);
      if (!manager) {
        throw new Error(`No active agent for session ${data.sessionId}`);
      }

      const messageId = addMessage(data.sessionId, 'user', data.prompt);

      const db = getDb();
      const sessionWorkspace = db
        .prepare(
          `SELECT s.workspace_id as workspace_id, w.worktree_path as worktree_path
           FROM sessions s
           JOIN workspaces w ON w.id = s.workspace_id
           WHERE s.id = ?`,
        )
        .get(data.sessionId) as { workspace_id: string; worktree_path: string | null } | undefined;

      if (!sessionWorkspace) {
        throw new Error(`Session ${data.sessionId} not found`);
      }
      if (!sessionWorkspace.worktree_path) {
        throw new Error(`Workspace ${sessionWorkspace.workspace_id} has no worktree path`);
      }

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
