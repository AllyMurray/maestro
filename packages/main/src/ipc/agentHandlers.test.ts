import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IPC_CHANNELS } from '@maestro/shared';

const mockDbGet = vi.fn();

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
  discoverAgents: vi.fn().mockResolvedValue([
    { type: 'claude-code', displayName: 'Claude Code', available: true },
    { type: 'codex', displayName: 'Codex', available: true },
    { type: 'cursor', displayName: 'Cursor', available: true },
  ]),
}));

vi.mock('../services/sessionManager', () => ({
  createSession: vi.fn(() => ({ id: 'session-1' })),
  updateSessionStatus: vi.fn(),
  setAgentSessionId: vi.fn(),
  addMessage: vi.fn(() => 123),
}));

vi.mock('../services/checkpointManager', () => ({
  createCheckpoint: vi.fn().mockResolvedValue({ id: 77, commitHash: 'abc123' }),
}));

vi.mock('../database/db', () => ({
  getDb: vi.fn(() => ({
    prepare: vi.fn(() => ({
      get: mockDbGet,
    })),
  })),
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
    mockDbGet.mockReturnValue({ workspace_id: 'ws-1', worktree_path: '/path' });

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
        handler(
          { sender: {} },
          {
            workspaceId: 'ws-1',
            workspacePath: '',
            agentType: 'cursor',
            opts: {},
          },
        ),
      ).rejects.toThrow('workspacePath is required to start an agent');
    });

    it('throws when workspacePath is undefined', async () => {
      const handler = handlers[IPC_CHANNELS.AGENT_START];

      await expect(
        handler(
          { sender: {} },
          {
            workspaceId: 'ws-1',
            workspacePath: undefined,
            agentType: 'cursor',
            opts: {},
          },
        ),
      ).rejects.toThrow('workspacePath is required to start an agent');
    });

    it('succeeds when workspacePath is provided', async () => {
      const handler = handlers[IPC_CHANNELS.AGENT_START];

      const result = await handler(
        { sender: {} },
        {
          workspaceId: 'ws-1',
          workspacePath: '/valid/path',
          agentType: 'cursor',
          opts: {},
        },
      );

      expect(result).toEqual({ sessionId: 'session-1' });
    });

    it('throws when selected agent is unavailable', async () => {
      const { discoverAgents } = await import('../services/agents');
      (discoverAgents as any).mockResolvedValueOnce([
        { type: 'claude-code', displayName: 'Claude Code', available: true },
        {
          type: 'codex',
          displayName: 'Codex',
          available: false,
          reason: 'Upgrade required (need >= 0.104.0, got 0.90.0)',
        },
        { type: 'cursor', displayName: 'Cursor', available: true },
      ]);

      const handler = handlers[IPC_CHANNELS.AGENT_START];
      await expect(
        handler(
          { sender: {} },
          {
            workspaceId: 'ws-1',
            workspacePath: '/path',
            agentType: 'codex',
            opts: {},
          },
        ),
      ).rejects.toThrow('Codex is unavailable: Upgrade required');
    });
  });

  // ─── API key resolution from config ──────────────────────────────

  describe('resolveOpts - API key from config', () => {
    it('resolves openai_api_key for codex agent', async () => {
      const { createAgentManager } = await import('../services/agents');
      const handler = handlers[IPC_CHANNELS.AGENT_START];

      await handler(
        { sender: {} },
        {
          workspaceId: 'ws-1',
          workspacePath: '/path',
          agentType: 'codex',
          opts: {},
        },
      );

      const mockManager = (createAgentManager as any).mock.results[0].value;
      expect(mockManager.start).toHaveBeenCalledWith(
        '/path',
        expect.objectContaining({
          apiKey: 'sk-openai-stored',
        }),
      );
    });

    it('resolves anthropic_api_key for claude-code agent', async () => {
      const { createAgentManager } = await import('../services/agents');
      const handler = handlers[IPC_CHANNELS.AGENT_START];

      await handler(
        { sender: {} },
        {
          workspaceId: 'ws-1',
          workspacePath: '/path',
          agentType: 'claude-code',
          opts: {},
        },
      );

      const mockManager = (createAgentManager as any).mock.results[0].value;
      expect(mockManager.start).toHaveBeenCalledWith(
        '/path',
        expect.objectContaining({
          apiKey: 'sk-ant-stored',
          model: 'claude-sonnet-4-20250514',
        }),
      );
    });

    it('resolves cursor_api_key for cursor agent', async () => {
      const { createAgentManager } = await import('../services/agents');
      const handler = handlers[IPC_CHANNELS.AGENT_START];

      await handler(
        { sender: {} },
        {
          workspaceId: 'ws-1',
          workspacePath: '/path',
          agentType: 'cursor',
          opts: {},
        },
      );

      const mockManager = (createAgentManager as any).mock.results[0].value;
      expect(mockManager.start).toHaveBeenCalledWith(
        '/path',
        expect.objectContaining({
          apiKey: 'sk-cursor-stored',
        }),
      );
    });

    it('does not override explicit apiKey from opts', async () => {
      const { createAgentManager } = await import('../services/agents');
      const handler = handlers[IPC_CHANNELS.AGENT_START];

      await handler(
        { sender: {} },
        {
          workspaceId: 'ws-1',
          workspacePath: '/path',
          agentType: 'codex',
          opts: { apiKey: 'sk-explicit' },
        },
      );

      const mockManager = (createAgentManager as any).mock.results[0].value;
      expect(mockManager.start).toHaveBeenCalledWith(
        '/path',
        expect.objectContaining({
          apiKey: 'sk-explicit',
        }),
      );
    });
  });

  describe('AGENT_SEND checkpoints', () => {
    it('creates a checkpoint before sending prompt', async () => {
      const { getActiveManager } = await import('../services/agents');
      const { addMessage } = await import('../services/sessionManager');
      const { createCheckpoint } = await import('../services/checkpointManager');

      const send = vi.fn().mockResolvedValue(undefined);
      (getActiveManager as any).mockReturnValue({ send, status: 'running' });
      (addMessage as any).mockReturnValue(456);

      const handler = handlers[IPC_CHANNELS.AGENT_SEND];
      const result = await handler(null, { sessionId: 'session-1', prompt: 'Ship it' });

      expect(createCheckpoint).toHaveBeenCalledWith('/path', 'ws-1', 'session-1', 456);
      expect(send).toHaveBeenCalledWith('Ship it');
      expect(result).toEqual({ success: true });
    });

    it('throws when workspace has no worktree path', async () => {
      const { getActiveManager } = await import('../services/agents');

      (getActiveManager as any).mockReturnValue({ send: vi.fn(), status: 'running' });
      mockDbGet.mockReturnValueOnce({ workspace_id: 'ws-1', worktree_path: null });

      const handler = handlers[IPC_CHANNELS.AGENT_SEND];
      await expect(handler(null, { sessionId: 'session-1', prompt: 'hello' })).rejects.toThrow(
        'Workspace ws-1 has no worktree path',
      );
    });

    it('continues sending when checkpoint creation fails', async () => {
      const { getActiveManager } = await import('../services/agents');
      const { createCheckpoint } = await import('../services/checkpointManager');

      const send = vi.fn().mockResolvedValue(undefined);
      (getActiveManager as any).mockReturnValue({ send, status: 'running' });
      (createCheckpoint as any).mockRejectedValueOnce(new Error('git failed'));

      const handler = handlers[IPC_CHANNELS.AGENT_SEND];
      const result = await handler(null, { sessionId: 'session-1', prompt: 'go' });

      expect(send).toHaveBeenCalledWith('go');
      expect(result).toEqual({ success: true });
    });
  });
});
