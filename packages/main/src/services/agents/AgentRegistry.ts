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
  reason?: string;
}

let discoverAgentsOverride: (() => Promise<AgentInfo[]>) | null = null;

const MIN_VERSIONS: Record<AgentType, string> = {
  'claude-code': '1.0.0',
  codex: '0.104.0',
  cursor: '2.5.0',
};

function extractVersion(raw: string | undefined): string | null {
  if (!raw) return null;
  const match = raw.match(/(\d+)\.(\d+)\.(\d+)/);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : null;
}

function compareVersions(a: string, b: string): number {
  const av = a.split('.').map((x) => Number(x));
  const bv = b.split('.').map((x) => Number(x));

  for (let i = 0; i < 3; i += 1) {
    const ai = av[i] ?? 0;
    const bi = bv[i] ?? 0;
    if (ai > bi) return 1;
    if (ai < bi) return -1;
  }
  return 0;
}

function compatibilityError(type: AgentType, versionLine: string | undefined): string | null {
  const minVersion = MIN_VERSIONS[type];
  const parsed = extractVersion(versionLine);
  if (!parsed) {
    return `Upgrade required (need >= ${minVersion}, got unknown version)`;
  }
  if (compareVersions(parsed, minVersion) < 0) {
    return `Upgrade required (need >= ${minVersion}, got ${parsed})`;
  }
  return null;
}

const AGENT_DEFINITIONS: {
  type: AgentType;
  displayName: string;
  command: string;
  versionFlag: string;
}[] = [
  { type: 'claude-code', displayName: 'Claude Code', command: 'claude', versionFlag: '--version' },
  { type: 'codex', displayName: 'Codex', command: 'codex', versionFlag: '--version' },
  { type: 'cursor', displayName: 'Cursor', command: 'cursor-agent', versionFlag: '--version' },
];

async function checkCommand(
  command: string,
  args: string[],
): Promise<{ available: boolean; version?: string; reason?: string }> {
  try {
    const { stdout } = await execFileAsync(command, args, { timeout: 5000 });
    return { available: true, version: stdout.trim().split('\n')[0] };
  } catch {
    return { available: false, reason: 'Not installed' };
  }
}

async function checkAgent(def: {
  type: AgentType;
  command: string;
  versionFlag: string;
}): Promise<{ available: boolean; version?: string; command: string; reason?: string }> {
  if (def.type === 'cursor') {
    const cursorAgent = await checkCommand('cursor-agent', ['--version']);
    if (cursorAgent.available) {
      const reason = compatibilityError(def.type, cursorAgent.version);
      return {
        ...cursorAgent,
        command: 'cursor-agent',
        available: !reason,
        reason: reason ?? undefined,
      };
    }

    const cursorCli = await checkCommand('cursor', ['agent', '--version']);
    if (!cursorCli.available) {
      return { ...cursorCli, command: 'cursor' };
    }

    const reason = compatibilityError(def.type, cursorCli.version);
    return { ...cursorCli, command: 'cursor', available: !reason, reason: reason ?? undefined };
  }

  const res = await checkCommand(def.command, [def.versionFlag]);
  if (!res.available) {
    return { ...res, command: def.command };
  }

  const reason = compatibilityError(def.type, res.version);
  return { ...res, command: def.command, available: !reason, reason: reason ?? undefined };
}

export async function discoverAgents(): Promise<AgentInfo[]> {
  if (discoverAgentsOverride) {
    return discoverAgentsOverride();
  }

  const results = await Promise.all(
    AGENT_DEFINITIONS.map(async (def) => {
      const { available, version, command, reason } = await checkAgent(def);
      if (available) {
        logger.info(`Agent discovered: ${def.displayName} (${version})`);
      } else {
        logger.warn(`Agent unavailable: ${def.displayName}${reason ? ` - ${reason}` : ''}`);
      }
      return {
        type: def.type,
        displayName: def.displayName,
        command,
        available,
        version,
        reason,
      };
    }),
  );

  return results;
}

export async function isAgentAvailable(type: AgentType): Promise<boolean> {
  if (discoverAgentsOverride) {
    const agents = await discoverAgentsOverride();
    return agents.find((a) => a.type === type)?.available ?? false;
  }

  const def = AGENT_DEFINITIONS.find((d) => d.type === type);
  if (!def) return false;
  const { available } = await checkAgent(def);
  return available;
}

export function setDiscoverAgentsOverrideForTests(
  override: (() => Promise<AgentInfo[]>) | null,
): void {
  discoverAgentsOverride = override;
}
