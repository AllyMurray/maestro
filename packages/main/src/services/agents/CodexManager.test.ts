import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CodexManager } from './CodexManager';
import {
  THREAD_STARTED,
  ITEM_AGENT_MESSAGE,
  ITEM_COMMAND_EXECUTION,
  ITEM_FILE_CHANGE,
  TURN_COMPLETED,
  ERROR_EVENT,
  MULTI_LINE_STREAM,
} from '../../__test-utils__/fixtures/codex-stream';

const mockSpawn = vi.fn();
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    spawn: (...args: any[]) => mockSpawn(...args),
  };
});

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function createMockProcess() {
  return {
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    stdin: { write: vi.fn(), end: vi.fn() },
    on: vi.fn(),
    kill: vi.fn(),
    pid: 12345,
  };
}

describe('CodexManager', () => {
  let manager: CodexManager;

  beforeEach(() => {
    mockSpawn.mockReset();
    manager = new CodexManager();
  });

  it('has correct type and display name', () => {
    expect(manager.type).toBe('codex');
    expect(manager.displayName).toBe('Codex');
    expect(manager.command).toBe('codex');
  });

  it('starts with idle status', () => {
    expect(manager.status).toBe('idle');
  });

  // ─── start() ──────────────────────────────────────────────────────

  describe('start()', () => {
    it('stores opts for later use in send()', async () => {
      await manager.start('/test', { model: 'o3', apiKey: 'sk-test' });
      expect((manager as any)._opts).toEqual({ model: 'o3', apiKey: 'sk-test' });
    });

    it('sets status to waiting (not running)', async () => {
      const statuses: string[] = [];
      manager.on('status', (s) => statuses.push(s));

      await manager.start('/test', {});

      expect(statuses).toContain('starting');
      expect(statuses).toContain('waiting');
      expect(statuses).not.toContain('running');
      expect(manager.status).toBe('waiting');
    });

    it('stores workspace path', async () => {
      await manager.start('/my/project', {});
      expect((manager as any)._workspacePath).toBe('/my/project');
    });
  });

  // ─── send() args ──────────────────────────────────────────────────

  describe('send() args', () => {
    beforeEach(async () => {
      await manager.start('/workspace', {});
    });

    it('spawns codex with exec subcommand as first arg', async () => {
      const mockProc = createMockProcess();
      mockSpawn.mockReturnValue(mockProc);

      await manager.send('hello world');

      expect(mockSpawn).toHaveBeenCalledTimes(1);
      const [cmd, args] = mockSpawn.mock.calls[0];
      expect(cmd).toBe('codex');
      expect(args[0]).toBe('exec');
    });

    it('includes --json flag', async () => {
      const mockProc = createMockProcess();
      mockSpawn.mockReturnValue(mockProc);

      await manager.send('hello');

      const [, args] = mockSpawn.mock.calls[0];
      expect(args).toContain('--json');
    });

    it('includes -a never for auto-approve off', async () => {
      const mockProc = createMockProcess();
      mockSpawn.mockReturnValue(mockProc);

      await manager.send('hello');

      const [, args] = mockSpawn.mock.calls[0];
      expect(args).toContain('-a');
      expect(args[args.indexOf('-a') + 1]).toBe('never');
    });

    it('passes -C with the workspace path', async () => {
      const mockProc = createMockProcess();
      mockSpawn.mockReturnValue(mockProc);

      await manager.send('hello');

      const [, args] = mockSpawn.mock.calls[0];
      expect(args).toContain('-C');
      expect(args[args.indexOf('-C') + 1]).toBe('/workspace');
    });

    it('passes -m when model is set via opts', async () => {
      await manager.start('/workspace', { model: 'o3' });
      const mockProc = createMockProcess();
      mockSpawn.mockReturnValue(mockProc);

      await manager.send('hello');

      const [, args] = mockSpawn.mock.calls[0];
      expect(args).toContain('-m');
      expect(args[args.indexOf('-m') + 1]).toBe('o3');
    });

    it('omits -m when model is not set', async () => {
      const mockProc = createMockProcess();
      mockSpawn.mockReturnValue(mockProc);

      await manager.send('hello');

      const [, args] = mockSpawn.mock.calls[0];
      expect(args).not.toContain('-m');
    });

    it('puts prompt as the last positional argument', async () => {
      const mockProc = createMockProcess();
      mockSpawn.mockReturnValue(mockProc);

      await manager.send('fix the bug');

      const [, args] = mockSpawn.mock.calls[0];
      expect(args[args.length - 1]).toBe('fix the bug');
    });

    it('does NOT use --quiet flag', async () => {
      const mockProc = createMockProcess();
      mockSpawn.mockReturnValue(mockProc);

      await manager.send('hello');

      const [, args] = mockSpawn.mock.calls[0];
      expect(args).not.toContain('--quiet');
    });

    it('sets OPENAI_API_KEY env when apiKey is provided', async () => {
      await manager.start('/workspace', { apiKey: 'sk-secret' });
      const mockProc = createMockProcess();
      mockSpawn.mockReturnValue(mockProc);

      await manager.send('hello');

      const [, , opts] = mockSpawn.mock.calls[0];
      expect(opts.env.OPENAI_API_KEY).toBe('sk-secret');
    });

    it('does not set OPENAI_API_KEY when no apiKey provided', async () => {
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      await manager.start('/workspace', {});
      const mockProc = createMockProcess();
      mockSpawn.mockReturnValue(mockProc);

      await manager.send('hello');

      const [, , opts] = mockSpawn.mock.calls[0];
      expect(opts.env.OPENAI_API_KEY).toBeUndefined();

      // Restore
      if (originalKey) process.env.OPENAI_API_KEY = originalKey;
    });
  });

  // ─── processBuffer ────────────────────────────────────────────────

  describe('processBuffer', () => {
    it('processes complete JSON lines', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      (manager as any).buffer = ITEM_AGENT_MESSAGE + '\n';
      (manager as any).processBuffer();

      expect(outputs).toHaveLength(1);
      expect(outputs[0].type).toBe('text');
      expect(outputs[0].content).toBe('I will fix the bug in index.ts.');
    });

    it('keeps incomplete lines in buffer', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      (manager as any).buffer = '{"type":"item.completed","item":';
      (manager as any).processBuffer();

      expect(outputs).toHaveLength(0);
      expect((manager as any).buffer).toBe('{"type":"item.completed","item":');
    });

    it('does not emit non-JSON lines as text (logs them instead)', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      (manager as any).buffer = 'Some plain text output\n';
      (manager as any).processBuffer();

      expect(outputs).toHaveLength(0);
    });

    it('skips empty lines', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      (manager as any).buffer = '\n  \n' + ITEM_AGENT_MESSAGE + '\n';
      (manager as any).processBuffer();

      expect(outputs).toHaveLength(1);
      expect(outputs[0].content).toBe('I will fix the bug in index.ts.');
    });

    it('handles multiple lines in one buffer', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      (manager as any).buffer = MULTI_LINE_STREAM + '\n';
      (manager as any).processBuffer();

      // THREAD_STARTED -> session_id (not output), ITEM_AGENT_MESSAGE -> text,
      // ITEM_COMMAND_EXECUTION -> tool_call + tool_result, ITEM_FILE_CHANGE -> tool_call,
      // TURN_COMPLETED -> no-op
      expect(outputs).toHaveLength(4);
    });
  });

  // ─── handleMessage ────────────────────────────────────────────────

  describe('handleMessage', () => {
    it('emits session_id from thread.started', () => {
      let receivedId: string | undefined;
      manager.on('session_id', (id) => {
        receivedId = id;
      });

      (manager as any).handleMessage(JSON.parse(THREAD_STARTED));

      expect(receivedId).toBe('thread-abc-123');
      expect(manager.sessionId).toBe('thread-abc-123');
    });

    it('ignores thread.started without thread_id', () => {
      let receivedId: string | undefined;
      manager.on('session_id', (id) => {
        receivedId = id;
      });

      (manager as any).handleMessage({ type: 'thread.started' });

      expect(receivedId).toBeUndefined();
    });

    it('emits text from item.completed with agent_message', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      (manager as any).handleMessage(JSON.parse(ITEM_AGENT_MESSAGE));

      expect(outputs).toHaveLength(1);
      expect(outputs[0].type).toBe('text');
      expect(outputs[0].content).toBe('I will fix the bug in index.ts.');
    });

    it('emits tool_call and tool_result from item.completed with command_execution', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      (manager as any).handleMessage(JSON.parse(ITEM_COMMAND_EXECUTION));

      expect(outputs).toHaveLength(2);
      expect(outputs[0].type).toBe('tool_call');
      expect(outputs[0].metadata?.toolName).toBe('command_execution');
      const parsed = JSON.parse(outputs[0].content);
      expect(parsed.command).toBe('cat');
      expect(parsed.args).toEqual(['src/index.ts']);

      expect(outputs[1].type).toBe('tool_result');
      expect(outputs[1].content).toBe('console.log("hello");\n');
      expect(outputs[1].metadata?.exitCode).toBe(0);
    });

    it('emits tool_call from item.completed with file_change', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      (manager as any).handleMessage(JSON.parse(ITEM_FILE_CHANGE));

      expect(outputs).toHaveLength(1);
      expect(outputs[0].type).toBe('tool_call');
      expect(outputs[0].metadata?.toolName).toBe('file_change');
      const parsed = JSON.parse(outputs[0].content);
      expect(parsed.file).toBe('src/index.ts');
      expect(parsed.action).toBe('edit');
    });

    it('handles turn.completed as a no-op', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      (manager as any).handleMessage(JSON.parse(TURN_COMPLETED));

      expect(outputs).toHaveLength(0);
    });

    it('emits error output from error event', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      (manager as any).handleMessage(JSON.parse(ERROR_EVENT));

      expect(outputs).toHaveLength(1);
      expect(outputs[0].type).toBe('error');
      expect(outputs[0].content).toBe('Rate limit exceeded');
    });

    it('ignores error event without message', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      (manager as any).handleMessage({ type: 'error' });

      expect(outputs).toHaveLength(0);
    });

    it('ignores item.completed without item', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      (manager as any).handleMessage({ type: 'item.completed' });

      expect(outputs).toHaveLength(0);
    });

    it('ignores unknown event types', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      (manager as any).handleMessage({ type: 'unknown.event', data: 'foo' });

      expect(outputs).toHaveLength(0);
    });
  });

  // ─── stop ─────────────────────────────────────────────────────────

  describe('stop', () => {
    it('sets status to stopped', async () => {
      await manager.stop();
      expect(manager.status).toBe('stopped');
    });
  });
});
