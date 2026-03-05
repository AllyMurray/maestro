import { beforeAll, describe, expect, it } from 'vitest';
import type { AgentOutput, AgentOpts } from '@maestro/shared';
import { createTempGitRepo, hasCommand } from '../../__test-utils__/exec';
import { BaseAgentManager } from './BaseAgentManager';
import { ClaudeCodeManager } from './ClaudeCodeManager';
import { CodexManager } from './CodexManager';
import { CursorManager } from './CursorManager';

const RUN_REAL_AGENT_SMOKE = process.env.MAESTRO_RUN_REAL_AGENT_SMOKE === '1';
const TURN_TIMEOUT_MS = 120_000;
const PROMPT = 'Reply with exactly: OK';

let hasClaude = false;
let hasCodex = false;
let hasCursorAgent = false;
let hasCursorCli = false;

beforeAll(async () => {
  [hasClaude, hasCodex, hasCursorAgent, hasCursorCli] = await Promise.all([
    hasCommand('claude'),
    hasCommand('codex'),
    hasCommand('cursor-agent'),
    hasCommand('cursor', ['agent', '--version']),
  ]);
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

      let sawTextOutput = false;

      manager.on('output', (output: unknown) => {
        const typed = output as AgentOutput;
        outputs.push(typed);
        if (typed.type === 'text' && typed.content.trim().length > 0) {
          sawTextOutput = true;
        }
      });

      manager.on('status', (status: unknown) => {
        const typed = String(status);
        statuses.push(typed);
        if (typed === 'waiting' && sawTextOutput) {
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
  it.skipIf(!hasClaude || !process.env.ANTHROPIC_API_KEY)(
    'Claude Code can complete one chat turn',
    async () => {
      const manager = new ClaudeCodeManager();
      const { outputs, statuses } = await runSingleTurn(manager, {
        apiKey: process.env.ANTHROPIC_API_KEY,
        permissions: 'skip',
      });

      expect(statuses).toContain('running');
      expect(statuses).toContain('waiting');
      expect(outputs.some((o) => o.type === 'text' && o.content.trim().length > 0)).toBe(true);
    },
  );

  it.skipIf(!hasCodex || !process.env.OPENAI_API_KEY)(
    'Codex can complete one chat turn',
    async () => {
      const manager = new CodexManager();
      const { outputs, statuses } = await runSingleTurn(manager, {
        apiKey: process.env.OPENAI_API_KEY,
      });

      expect(statuses).toContain('running');
      expect(statuses).toContain('waiting');
      expect(outputs.some((o) => o.type === 'text' && o.content.trim().length > 0)).toBe(true);
    },
  );

  it.skipIf(!(hasCursorAgent || hasCursorCli) || !process.env.CURSOR_API_KEY)(
    'Cursor can complete one chat turn',
    async () => {
      const manager = new CursorManager();
      const { outputs, statuses } = await runSingleTurn(manager, {
        apiKey: process.env.CURSOR_API_KEY,
        permissions: 'skip',
      });

      expect(statuses).toContain('running');
      expect(statuses).toContain('waiting');
      expect(outputs.some((o) => o.type === 'text' && o.content.trim().length > 0)).toBe(true);
    },
  );
});
