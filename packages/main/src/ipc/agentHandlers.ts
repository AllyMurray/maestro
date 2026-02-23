import { IpcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS, AgentType, AgentOpts } from '@maestro/shared';
import {
  createAgentManager,
  getActiveManager,
  registerManager,
  unregisterManager,
  discoverAgents,
} from '../services/agents';
import { createSession, updateSessionStatus, setAgentSessionId, addMessage } from '../services/sessionManager';
import { logger } from '../services/logger';

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
      const session = createSession(data.workspaceId, data.agentType, data.opts?.model);
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
        addMessage(session.id, output.type === 'text' ? 'assistant' : output.type, output.content, output.metadata);
      });

      manager.on('status', (status) => {
        updateSessionStatus(session.id, status === 'waiting' ? 'waiting' : status === 'running' ? 'running' : status === 'error' ? 'error' : 'running');
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
      await manager.start(data.workspacePath, data.opts || {});

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

      addMessage(data.sessionId, 'user', data.prompt);
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
