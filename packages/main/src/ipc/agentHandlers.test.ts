import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IPC_CHANNELS } from '@maestro/shared';

vi.mock('../services/agents', () => ({
  createAgentManager: vi.fn(() => ({
    on: vi.fn(),
    start: vi.fn(),
    send: vi.fn(),
    stop: vi.fn(),
    status: 'idle',
  })),
  getActiveManager: vi.fn(),
  registerManager: vi.fn(),
  unregisterManager: vi.fn(),
  discoverAgents: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/sessionManager', () => ({
  createSession: vi.fn(() => ({ id: 'session-1' })),
  updateSessionStatus: vi.fn(),
  setAgentSessionId: vi.fn(),
  addMessage: vi.fn(),
}));

vi.mock('../services/configManager', () => ({
  getConfig: vi.fn((key: string) => {
    const configs: Record<string, string> = {
      anthropic_api_key: 'sk-ant-stored',
      openai_api_key: 'sk-openai-stored',
      cursor_api_key: 'sk-cursor-stored',
      claude_model: 'claude-sonnet-4-20250514',
    };
    return configs[key] ?? null;
  }),
}));

vi.mock('../services/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('electron', () => ({
  BrowserWindow: {
    fromWebContents: vi.fn(() => ({
      webContents: { send: vi.fn() },
    })),
  },
}));

describe('agentHandlers', () => {
  let handlers: Record<string, (...args: any[]) => any>;

  beforeEach(async () => {
    handlers = {};
    vi.clearAllMocks();

    const mockIpcMain = {
      handle: vi.fn((channel: string, handler: any) => {
        handlers[channel] = handler;
      }),
    };

    const { registerAgentHandlers } = await import('./agentHandlers');
    registerAgentHandlers(mockIpcMain as any);
  });

  // ─── Bug 3 proof: workspace path validation ────────────────────────

  describe('AGENT_START workspacePath validation (Bug 3 fix)', () => {
    it('throws when workspacePath is empty string', async () => {
      const handler = handlers[IPC_CHANNELS.AGENT_START];
      expect(handler).toBeDefined();

      await expect(
        handler({ sender: {} }, {
          workspaceId: 'ws-1',
          workspacePath: '',
          agentType: 'cursor',
          opts: {},
        }),
      ).rejects.toThrow('workspacePath is required to start an agent');
    });

    it('throws when workspacePath is undefined', async () => {
      const handler = handlers[IPC_CHANNELS.AGENT_START];

      await expect(
        handler({ sender: {} }, {
          workspaceId: 'ws-1',
          workspacePath: undefined,
          agentType: 'cursor',
          opts: {},
        }),
      ).rejects.toThrow('workspacePath is required to start an agent');
    });

    it('succeeds when workspacePath is provided', async () => {
      const handler = handlers[IPC_CHANNELS.AGENT_START];

      const result = await handler({ sender: {} }, {
        workspaceId: 'ws-1',
        workspacePath: '/valid/path',
        agentType: 'cursor',
        opts: {},
      });

      expect(result).toEqual({ sessionId: 'session-1' });
    });
  });

  // ─── API key resolution from config ──────────────────────────────

  describe('resolveOpts - API key from config', () => {
    it('resolves openai_api_key for codex agent', async () => {
      const { createAgentManager } = await import('../services/agents');
      const handler = handlers[IPC_CHANNELS.AGENT_START];

      await handler({ sender: {} }, {
        workspaceId: 'ws-1',
        workspacePath: '/path',
        agentType: 'codex',
        opts: {},
      });

      const mockManager = (createAgentManager as any).mock.results[0].value;
      expect(mockManager.start).toHaveBeenCalledWith('/path', expect.objectContaining({
        apiKey: 'sk-openai-stored',
      }));
    });

    it('resolves anthropic_api_key for claude-code agent', async () => {
      const { createAgentManager } = await import('../services/agents');
      const handler = handlers[IPC_CHANNELS.AGENT_START];

      await handler({ sender: {} }, {
        workspaceId: 'ws-1',
        workspacePath: '/path',
        agentType: 'claude-code',
        opts: {},
      });

      const mockManager = (createAgentManager as any).mock.results[0].value;
      expect(mockManager.start).toHaveBeenCalledWith('/path', expect.objectContaining({
        apiKey: 'sk-ant-stored',
        model: 'claude-sonnet-4-20250514',
      }));
    });

    it('resolves cursor_api_key for cursor agent', async () => {
      const { createAgentManager } = await import('../services/agents');
      const handler = handlers[IPC_CHANNELS.AGENT_START];

      await handler({ sender: {} }, {
        workspaceId: 'ws-1',
        workspacePath: '/path',
        agentType: 'cursor',
        opts: {},
      });

      const mockManager = (createAgentManager as any).mock.results[0].value;
      expect(mockManager.start).toHaveBeenCalledWith('/path', expect.objectContaining({
        apiKey: 'sk-cursor-stored',
      }));
    });

    it('does not override explicit apiKey from opts', async () => {
      const { createAgentManager } = await import('../services/agents');
      const handler = handlers[IPC_CHANNELS.AGENT_START];

      await handler({ sender: {} }, {
        workspaceId: 'ws-1',
        workspacePath: '/path',
        agentType: 'codex',
        opts: { apiKey: 'sk-explicit' },
      });

      const mockManager = (createAgentManager as any).mock.results[0].value;
      expect(mockManager.start).toHaveBeenCalledWith('/path', expect.objectContaining({
        apiKey: 'sk-explicit',
      }));
    });
  });
});
