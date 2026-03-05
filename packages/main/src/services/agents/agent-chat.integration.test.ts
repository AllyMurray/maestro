import { beforeAll, describe, expect, it } from 'vitest';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { AgentOutput, AgentOpts } from '@maestro/shared';
import { createTempGitRepo, hasCommand } from '../../__test-utils__/exec';
import { BaseAgentManager } from './BaseAgentManager';
import { ClaudeCodeManager } from './ClaudeCodeManager';
import { CodexManager } from './CodexManager';
import { CursorManager } from './CursorManager';

const execFileAsync = promisify(execFile);
const RUN_REAL_AGENT_SMOKE = process.env.MAESTRO_RUN_REAL_AGENT_SMOKE === '1';
const TURN_TIMEOUT_MS = 120_000;
const TEST_TIMEOUT_MS = 180_000;
const PROMPT = 'Reply with exactly: OK';

let hasClaude = false;
let hasCodex = false;
let hasCursorAgent = false;
let hasCursorCli = false;

async function getCommandOutput(command: string, args: string[]): Promise<string> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, { timeout: 20000 });
    return `${stdout ?? ''}\n${stderr ?? ''}`.trim();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err);
    throw new Error(`Failed to run ${command} ${args.join(' ')}: ${message}`);
  }
}

beforeAll(async () => {
  [hasClaude, hasCodex, hasCursorAgent, hasCursorCli] = await Promise.all([
    hasCommand('claude'),
    hasCommand('codex'),
    hasCommand('cursor-agent'),
    hasCommand('cursor', ['agent', '--version']),
  ]);

  if (hasClaude) {
    const output = await getCommandOutput('claude', ['auth', 'status']);
    try {
      const parsed = JSON.parse(output) as { loggedIn?: boolean };
      if (!parsed.loggedIn) {
        throw new Error('Claude CLI is installed but not authenticated. Run: claude auth login');
      }
    } catch {
      throw new Error(
        `Claude CLI auth status was not readable or unauthenticated. Output: ${output || '(empty)'}`,
      );
    }
  }

  if (hasCodex) {
    const output = await getCommandOutput('codex', ['login', 'status']);
    if (!/logged in/i.test(output)) {
      throw new Error(
        `Codex CLI is installed but not authenticated. Run: codex login. Output: ${output || '(empty)'}`,
      );
    }
  }

  if (hasCursorAgent || hasCursorCli) {
    const command = hasCursorAgent ? 'cursor-agent' : 'cursor';
    const args = hasCursorAgent ? ['status'] : ['agent', 'status'];
    const output = await getCommandOutput(command, args);
    if (!/logged in/i.test(output)) {
      throw new Error(
        `Cursor CLI is installed but not authenticated. Run: ${command} login. Output: ${output || '(empty)'}`,
      );
    }
  }
});

async function runSingleTurn(
  manager: BaseAgentManager,
  opts: AgentOpts,
): Promise<{ outputs: AgentOutput[]; statuses: string[] }> {
  const repo = createTempGitRepo();
  const outputs: AgentOutput[] = [];
  const statuses: string[] = [];

  try {
    await manager.start(repo.path, opts);

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timed out waiting for agent response after ${TURN_TIMEOUT_MS}ms`));
      }, TURN_TIMEOUT_MS);

      manager.on('output', (output: unknown) => {
        const typed = output as AgentOutput;
        outputs.push(typed);
        if (typed.type === 'error' && typed.content.trim().length > 0) {
          clearTimeout(timer);
          reject(new Error(`Agent emitted error output: ${typed.content}`));
        }
      });

      manager.on('status', (status: unknown) => {
        const typed = String(status);
        statuses.push(typed);
        if (typed === 'waiting') {
          clearTimeout(timer);
          resolve();
        }
      });

      manager.on('error', (err: unknown) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      });

      manager.send(PROMPT).catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    return { outputs, statuses };
  } finally {
    await manager.stop().catch(() => {});
    repo.cleanup();
  }
}

describe.skipIf(!RUN_REAL_AGENT_SMOKE)('Real Agent Chat Smoke Tests', () => {
  it(
    'Claude Code can complete one chat turn',
    async () => {
      if (!hasClaude) return;
      const manager = new ClaudeCodeManager();
      const { outputs, statuses } = await runSingleTurn(manager, {
        permissions: 'skip',
      });

      expect(statuses).toContain('running');
      expect(statuses).toContain('waiting');
      expect(outputs.some((o) => o.type === 'text' && o.content.trim().length > 0)).toBe(true);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'Codex can complete one chat turn',
    async () => {
      if (!hasCodex) return;
      const manager = new CodexManager();
      const { outputs, statuses } = await runSingleTurn(manager, {});

      expect(statuses).toContain('running');
      expect(statuses).toContain('waiting');
      expect(outputs.some((o) => o.type === 'text' && o.content.trim().length > 0)).toBe(true);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'Cursor can complete one chat turn',
    async () => {
      if (!(hasCursorAgent || hasCursorCli)) return;
      const manager = new CursorManager();
      const { outputs, statuses } = await runSingleTurn(manager, {
        permissions: 'skip',
      });

      expect(statuses).toContain('running');
      expect(statuses).toContain('waiting');
      expect(outputs.some((o) => o.type === 'text' && o.content.trim().length > 0)).toBe(true);
    },
    TEST_TIMEOUT_MS,
  );
});
