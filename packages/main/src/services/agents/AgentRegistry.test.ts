import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExecFile = vi.fn();
vi.mock('child_process', () => ({
  execFile: (...args: any[]) => mockExecFile(...args),
  promisify: vi.fn(() => mockExecFile),
}));
vi.mock('util', () => ({
  promisify: vi.fn(() => mockExecFile),
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('AgentRegistry', () => {
  beforeEach(() => {
    mockExecFile.mockReset();
    vi.resetModules();
  });

  describe('discoverAgents', () => {
    it('returns all agents with availability status', async () => {
      mockExecFile.mockImplementation((...args: any[]) => {
        const cmd = args[0] as string;
        if (cmd === 'claude') return Promise.resolve({ stdout: 'claude 1.0.0', stderr: '' });
        if (cmd === 'codex') return Promise.reject(new Error('not found'));
        if (cmd === 'cursor') return Promise.resolve({ stdout: 'cursor 0.5.0', stderr: '' });
        return Promise.reject(new Error('unknown'));
      });

      const { discoverAgents } = await import('./AgentRegistry');
      const agents = await discoverAgents();

      expect(agents).toHaveLength(3);

      const claude = agents.find((a) => a.type === 'claude-code');
      expect(claude!.available).toBe(true);
      expect(claude!.version).toBe('claude 1.0.0');

      const codex = agents.find((a) => a.type === 'codex');
      expect(codex!.available).toBe(false);

      const cursor = agents.find((a) => a.type === 'cursor');
      expect(cursor!.available).toBe(true);
    });

    it('handles all agents unavailable', async () => {
      mockExecFile.mockRejectedValue(new Error('not found'));

      const { discoverAgents } = await import('./AgentRegistry');
      const agents = await discoverAgents();

      expect(agents).toHaveLength(3);
      agents.forEach((a) => expect(a.available).toBe(false));
    });
  });

  describe('isAgentAvailable', () => {
    it('returns true for available agent', async () => {
      mockExecFile.mockResolvedValue({ stdout: 'claude 1.0.0', stderr: '' });

      const { isAgentAvailable } = await import('./AgentRegistry');
      expect(await isAgentAvailable('claude-code')).toBe(true);
    });

    it('returns false for unavailable agent', async () => {
      mockExecFile.mockRejectedValue(new Error('not found'));

      const { isAgentAvailable } = await import('./AgentRegistry');
      expect(await isAgentAvailable('codex')).toBe(false);
    });

    it('returns false for unknown agent type', async () => {
      const { isAgentAvailable } = await import('./AgentRegistry');
      expect(await isAgentAvailable('unknown' as any)).toBe(false);
    });
  });
});
