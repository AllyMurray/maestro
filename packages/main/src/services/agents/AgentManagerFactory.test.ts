import { describe, it, expect, beforeEach } from 'vitest';
import {
  createAgentManager,
  registerManager,
  getActiveManager,
  unregisterManager,
  getAllActiveManagers,
} from './AgentManagerFactory';
import { ClaudeCodeManager } from './ClaudeCodeManager';
import { CodexManager } from './CodexManager';
import { CursorManager } from './CursorManager';

describe('AgentManagerFactory', () => {
  beforeEach(() => {
    // Clear active managers
    for (const [id] of getAllActiveManagers()) {
      unregisterManager(id);
    }
  });

  describe('createAgentManager', () => {
    it('creates ClaudeCodeManager for claude-code', () => {
      const manager = createAgentManager('claude-code');
      expect(manager).toBeInstanceOf(ClaudeCodeManager);
    });

    it('creates CodexManager for codex', () => {
      const manager = createAgentManager('codex');
      expect(manager).toBeInstanceOf(CodexManager);
    });

    it('creates CursorManager for cursor', () => {
      const manager = createAgentManager('cursor');
      expect(manager).toBeInstanceOf(CursorManager);
    });

    it('throws for unknown agent type', () => {
      expect(() => createAgentManager('unknown' as any)).toThrow('Unknown agent type');
    });
  });

  describe('manager registry', () => {
    it('registers and retrieves a manager', () => {
      const manager = createAgentManager('claude-code');
      registerManager('session-1', manager);
      expect(getActiveManager('session-1')).toBe(manager);
    });

    it('returns undefined for unregistered session', () => {
      expect(getActiveManager('nonexistent')).toBeUndefined();
    });

    it('unregisters a manager', () => {
      const manager = createAgentManager('codex');
      registerManager('session-2', manager);
      unregisterManager('session-2');
      expect(getActiveManager('session-2')).toBeUndefined();
    });

    it('getAllActiveManagers returns all registered', () => {
      const m1 = createAgentManager('claude-code');
      const m2 = createAgentManager('codex');
      registerManager('s1', m1);
      registerManager('s2', m2);

      const all = getAllActiveManagers();
      expect(all.size).toBe(2);
      expect(all.get('s1')).toBe(m1);
      expect(all.get('s2')).toBe(m2);
    });
  });
});
