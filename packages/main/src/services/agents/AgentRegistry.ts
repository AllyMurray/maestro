import { execFile } from 'child_process';
import { promisify } from 'util';
import type { AgentType } from '@maestro/shared';
import { logger } from '../logger';

const execFileAsync = promisify(execFile);

interface AgentInfo {
  type: AgentType;
  displayName: string;
  command: string;
  available: boolean;
  version?: string;
}

const AGENT_DEFINITIONS: { type: AgentType; displayName: string; command: string; versionFlag: string }[] = [
  { type: 'claude-code', displayName: 'Claude Code', command: 'claude', versionFlag: '--version' },
  { type: 'codex', displayName: 'Codex', command: 'codex', versionFlag: '--version' },
  { type: 'cursor', displayName: 'Cursor', command: 'cursor-agent', versionFlag: '--version' },
];

async function checkCommand(command: string, versionFlag: string): Promise<{ available: boolean; version?: string }> {
  try {
    const { stdout } = await execFileAsync(command, [versionFlag], { timeout: 5000 });
    return { available: true, version: stdout.trim().split('\n')[0] };
  } catch {
    return { available: false };
  }
}

export async function discoverAgents(): Promise<AgentInfo[]> {
  const results = await Promise.all(
    AGENT_DEFINITIONS.map(async (def) => {
      const { available, version } = await checkCommand(def.command, def.versionFlag);
      if (available) {
        logger.info(`Agent discovered: ${def.displayName} (${version})`);
      }
      return {
        type: def.type,
        displayName: def.displayName,
        command: def.command,
        available,
        version,
      };
    }),
  );

  return results;
}

export async function isAgentAvailable(type: AgentType): Promise<boolean> {
  const def = AGENT_DEFINITIONS.find((d) => d.type === type);
  if (!def) return false;
  const { available } = await checkCommand(def.command, def.versionFlag);
  return available;
}
