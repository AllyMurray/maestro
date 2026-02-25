import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('testHandlers', () => {
  const envBackup = process.env.MAESTRO_TEST;

  afterEach(() => {
    process.env.MAESTRO_TEST = envBackup;
  });

  beforeEach(() => {
    vi.resetModules();
  });

  it('does not register handlers unless MAESTRO_TEST=1', async () => {
    process.env.MAESTRO_TEST = '0';
    const handle = vi.fn();

    const { registerTestHandlers } = await import('./testHandlers');
    registerTestHandlers({ handle } as any);

    expect(handle).not.toHaveBeenCalled();
  });

  it('registers install handler in test mode (module patch may fail under ESM)', async () => {
    process.env.MAESTRO_TEST = '1';
    const handlers: Record<string, (...args: any[]) => any> = {};
    const ipcMain = {
      handle: vi.fn((channel: string, handler: any) => {
        handlers[channel] = handler;
      }),
    };

    const { registerTestHandlers } = await import('./testHandlers');
    registerTestHandlers(ipcMain as any);

    await expect(handlers['test:install-mock-agent']()).resolves.toEqual({ success: true });

    const { createAgentManager, setCreateAgentManagerOverrideForTests } =
      await import('../services/agents/AgentManagerFactory');
    const { discoverAgents, isAgentAvailable, setDiscoverAgentsOverrideForTests } =
      await import('../services/agents/AgentRegistry');

    const manager = createAgentManager('claude-code') as any;
    await manager.start();
    expect(manager.status).toBe('waiting');

    const agents = await discoverAgents();
    expect(agents.find((a) => a.type === 'claude-code')?.available).toBe(true);
    expect(await isAgentAvailable('claude-code')).toBe(true);

    setCreateAgentManagerOverrideForTests(null);
    setDiscoverAgentsOverrideForTests(null);
  });
});
