import { describe, it, expect, beforeAll } from 'vitest';
import { hasCommand } from '../../__test-utils__/exec';

let hasClaude = false;
let hasCodex = false;
let hasCursor = false;

beforeAll(async () => {
  const [claude, codex, cursorAgent, cursorCliAgent] = await Promise.all([
    hasCommand('claude'),
    hasCommand('codex'),
    hasCommand('cursor-agent'),
    hasCommand('cursor', ['agent', '--version']),
  ]);

  hasClaude = claude;
  hasCodex = codex;
  hasCursor = cursorAgent || cursorCliAgent;
});

describe('Agent CLI Integration', () => {
  describe('AgentRegistry.discoverAgents()', () => {
    it('discovers installed agents', async () => {
      const { discoverAgents } = await import('./AgentRegistry');
      const agents = await discoverAgents();

      expect(agents).toHaveLength(3);
      expect(agents.map((a) => a.type)).toEqual(['claude-code', 'codex', 'cursor']);

      // At least verify that the results match our hasCommand checks
      const claude = agents.find((a) => a.type === 'claude-code');
      expect(claude!.available).toBe(hasClaude);
    });
  });

  describe('isAgentAvailable', () => {
    it('correctly reports claude availability', async () => {
      const { isAgentAvailable } = await import('./AgentRegistry');
      expect(await isAgentAvailable('claude-code')).toBe(hasClaude);
    });

    it('correctly reports codex availability', async () => {
      const { isAgentAvailable } = await import('./AgentRegistry');
      expect(await isAgentAvailable('codex')).toBe(hasCodex);
    });

    it('correctly reports cursor availability', async () => {
      const { isAgentAvailable } = await import('./AgentRegistry');
      expect(await isAgentAvailable('cursor')).toBe(hasCursor);
    });
  });

  describe.skipIf(!hasClaude)('ClaudeCodeManager', () => {
    it('isAvailable returns true when claude is installed', async () => {
      const { ClaudeCodeManager } = await import('./ClaudeCodeManager');
      const manager = new ClaudeCodeManager();
      expect(await manager.isAvailable()).toBe(true);
    });
  });
});
