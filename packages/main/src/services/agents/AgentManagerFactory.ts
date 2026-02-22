import type { AgentType } from '@maestro/shared';
import { BaseAgentManager } from './BaseAgentManager';
import { ClaudeCodeManager } from './ClaudeCodeManager';
import { CodexManager } from './CodexManager';
import { CursorManager } from './CursorManager';

const activeManagers = new Map<string, BaseAgentManager>();

export function createAgentManager(type: AgentType): BaseAgentManager {
  switch (type) {
    case 'claude-code':
      return new ClaudeCodeManager();
    case 'codex':
      return new CodexManager();
    case 'cursor':
      return new CursorManager();
    default:
      throw new Error(`Unknown agent type: ${type}`);
  }
}

export function getActiveManager(sessionId: string): BaseAgentManager | undefined {
  return activeManagers.get(sessionId);
}

export function registerManager(sessionId: string, manager: BaseAgentManager): void {
  activeManagers.set(sessionId, manager);
}

export function unregisterManager(sessionId: string): void {
  activeManagers.delete(sessionId);
}

export function getAllActiveManagers(): Map<string, BaseAgentManager> {
  return activeManagers;
}
