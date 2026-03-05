import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CursorManager } from './CursorManager';

const mockExecFile = vi.fn();
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    execFile: (...args: any[]) => mockExecFile(...args),
  };
});
vi.mock('util', async (importOriginal) => {
  const actual = await importOriginal<typeof import('util')>();
  return {
    ...actual,
    promisify: vi.fn(() => mockExecFile),
  };
});

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Capture spawn calls to verify the command and args
const mockSpawn = vi.fn();
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    spawn: (...args: any[]) => mockSpawn(...args),
    execFile: (...args: any[]) => mockExecFile(...args),
  };
});

function createMockProcess() {
  const proc = {
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    stdin: { write: vi.fn(), end: vi.fn() },
    on: vi.fn(),
    kill: vi.fn(),
    pid: 12345,
  };
  return proc;
}

describe('CursorManager', () => {
  let manager: CursorManager;

  beforeEach(() => {
    vi.useFakeTimers();
    mockExecFile.mockReset();
    mockSpawn.mockReset();
    manager = new CursorManager(5000); // Short watchdog for testing
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('has correct type and display name', () => {
    expect(manager.type).toBe('cursor');
    expect(manager.displayName).toBe('Cursor');
    expect(manager.command).toBe('cursor-agent');
  });

  it('starts with idle status', () => {
    expect(manager.status).toBe('idle');
  });

  it('emits status events when status changes', async () => {
    mockExecFile.mockResolvedValue({ stdout: 'cursor-agent 0.1.0', stderr: '' });
    const statuses: string[] = [];
    manager.on('status', (s) => statuses.push(s));

    await manager.start('/test', {});
    expect(statuses).toContain('starting');
    expect(statuses).toContain('running');
  });

  // ─── Bug 1 proof: command resolution ───────────────────────────────

  describe('command resolution (Bug 1 fix)', () => {
    it('defaults to cursor-agent, not cursor', () => {
      expect(manager.command).toBe('cursor-agent');
    });

    it('resolveCommand sets cursor-agent when available', async () => {
      mockExecFile.mockResolvedValue({ stdout: 'cursor-agent 0.1.0', stderr: '' });
      await manager.start('/test', {});
      expect(manager.command).toBe('cursor-agent');
    });

    it('resolveCommand falls back to cursor when cursor-agent is missing', async () => {
      mockExecFile.mockImplementation((...args: any[]) => {
        const cmd = args[0] as string;
        if (cmd === 'cursor-agent') return Promise.reject(new Error('not found'));
        return Promise.resolve({ stdout: 'cursor 0.5.0', stderr: '' });
      });
      await manager.start('/test', {});
      expect(manager.command).toBe('cursor');
    });

    it('stores opts from start() for use in send()', async () => {
      mockExecFile.mockResolvedValue({ stdout: 'cursor-agent 0.1.0', stderr: '' });
      await manager.start('/test', { model: 'gpt-4', apiKey: 'sk-test' });
      expect((manager as any)._opts).toEqual({ model: 'gpt-4', apiKey: 'sk-test' });
    });
  });

  // ─── Bug 1 proof: send() uses correct flags ───────────────────────

  describe('send() args (Bug 1 fix)', () => {
    beforeEach(async () => {
      mockExecFile.mockResolvedValue({ stdout: 'cursor-agent 0.1.0', stderr: '' });
    });

    it('spawns cursor-agent with streaming and trust flags', async () => {
      const mockProc = createMockProcess();
      mockSpawn.mockReturnValue(mockProc);

      await manager.start('/workspace', {});
      await manager.send('hello world');

      expect(mockSpawn).toHaveBeenCalledTimes(1);
      const [cmd, args, opts] = mockSpawn.mock.calls[0];
      expect(cmd).toBe('cursor-agent');
      expect(args).toContain('--print');
      expect(args).toContain('--trust');
      expect(args).toContain('--stream-partial-output');
      expect(args).toContain('--force');
      expect(args).toContain('--output-format');
      expect(args[args.indexOf('--output-format') + 1]).toBe('stream-json');
    });

    it('passes --workspace with the workspace path', async () => {
      const mockProc = createMockProcess();
      mockSpawn.mockReturnValue(mockProc);

      await manager.start('/my/workspace', {});
      await manager.send('hello');

      const [, args] = mockSpawn.mock.calls[0];
      expect(args).toContain('--workspace');
      expect(args[args.indexOf('--workspace') + 1]).toBe('/my/workspace');
    });

    it('prepends agent subcommand when falling back to cursor CLI', async () => {
      mockExecFile.mockImplementation((...args: any[]) => {
        const cmd = args[0] as string;
        if (cmd === 'cursor-agent') return Promise.reject(new Error('not found'));
        return Promise.resolve({ stdout: 'cursor 2.5.20', stderr: '' });
      });

      const mockProc = createMockProcess();
      mockSpawn.mockReturnValue(mockProc);

      await manager.start('/workspace', {});
      await manager.send('hello');

      const [cmd, args] = mockSpawn.mock.calls[0];
      expect(cmd).toBe('cursor');
      expect(args[0]).toBe('agent');
      expect(args).toContain('--print');
    });

    it('passes --model when model is set via opts', async () => {
      const mockProc = createMockProcess();
      mockSpawn.mockReturnValue(mockProc);

      await manager.start('/workspace', { model: 'gpt-4o' });
      await manager.send('hello');

      const [, args] = mockSpawn.mock.calls[0];
      expect(args).toContain('--model');
      expect(args[args.indexOf('--model') + 1]).toBe('gpt-4o');
    });

    it('passes --resume when sessionId is set', async () => {
      const mockProc = createMockProcess();
      mockSpawn.mockReturnValue(mockProc);

      await manager.start('/workspace', {});
      // Simulate a session_id being set by a previous response
      (manager as any)._sessionId = 'session-abc';
      await manager.send('follow up');

      const [, args] = mockSpawn.mock.calls[0];
      expect(args).toContain('--resume');
      expect(args[args.indexOf('--resume') + 1]).toBe('session-abc');
    });

    it('passes --resume from opts when restoring an existing session', async () => {
      const mockProc = createMockProcess();
      mockSpawn.mockReturnValue(mockProc);

      await manager.start('/workspace', { resumeSessionId: 'agent-session-xyz' });
      await manager.send('follow up');

      const [, args] = mockSpawn.mock.calls[0];
      expect(args).toContain('--resume');
      expect(args[args.indexOf('--resume') + 1]).toBe('agent-session-xyz');
    });

    it('puts prompt as the last positional argument', async () => {
      const mockProc = createMockProcess();
      mockSpawn.mockReturnValue(mockProc);

      await manager.start('/workspace', {});
      await manager.send('fix the bug');

      const [, args] = mockSpawn.mock.calls[0];
      expect(args[args.length - 1]).toBe('fix the bug');
    });

    it('does NOT use -p flag (the old broken behavior)', async () => {
      const mockProc = createMockProcess();
      mockSpawn.mockReturnValue(mockProc);

      await manager.start('/workspace', {});
      await manager.send('hello');

      const [, args] = mockSpawn.mock.calls[0];
      expect(args).not.toContain('-p');
    });

    it('sets CURSOR_API_KEY env when apiKey is provided', async () => {
      const mockProc = createMockProcess();
      mockSpawn.mockReturnValue(mockProc);

      await manager.start('/workspace', { apiKey: 'sk-secret' });
      await manager.send('hello');

      const [, , opts] = mockSpawn.mock.calls[0];
      expect(opts.env.CURSOR_API_KEY).toBe('sk-secret');
    });

    it('does not pass --force when permissions are explicitly default', async () => {
      const mockProc = createMockProcess();
      mockSpawn.mockReturnValue(mockProc);

      await manager.start('/workspace', { permissions: 'default' });
      await manager.send('hello');

      const [, args] = mockSpawn.mock.calls[0];
      expect(args).not.toContain('--force');
    });
  });

  describe('processBuffer', () => {
    it('processes complete JSON lines', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      (manager as any).buffer = '{"type":"result","result":"Done"}\n';
      (manager as any).processBuffer();

      expect(outputs).toHaveLength(1);
      expect(outputs[0].type).toBe('text');
      expect(outputs[0].content).toBe('Done');
    });

    it('keeps incomplete lines in buffer', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      (manager as any).buffer = '{"type":"result","result":';
      (manager as any).processBuffer();

      expect(outputs).toHaveLength(0);
      expect((manager as any).buffer).toBe('{"type":"result","result":');
    });

    it('emits plain text for non-JSON lines', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      (manager as any).buffer = 'Plain text output\n';
      (manager as any).processBuffer();

      expect(outputs).toHaveLength(1);
      expect(outputs[0].type).toBe('text');
      expect(outputs[0].content).toBe('Plain text output');
    });

    it('skips empty lines', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      (manager as any).buffer = '\n  \n{"type":"result","result":"hi"}\n';
      (manager as any).processBuffer();

      expect(outputs).toHaveLength(1);
      expect(outputs[0].content).toBe('hi');
    });
  });

  describe('handleMessage', () => {
    it('emits session_id from system message', () => {
      let receivedId: string | undefined;
      manager.on('session_id', (id) => {
        receivedId = id;
      });

      (manager as any).handleMessage({ type: 'system', session_id: 'cursor-session-1' });

      expect(receivedId).toBe('cursor-session-1');
    });

    it('ignores system message without session_id', () => {
      let receivedId: string | undefined;
      manager.on('session_id', (id) => {
        receivedId = id;
      });

      (manager as any).handleMessage({ type: 'system' });

      expect(receivedId).toBeUndefined();
    });

    it('emits text from content_block_delta with text_delta', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      (manager as any).handleMessage({
        type: 'content_block_delta',
        delta: { type: 'text_delta', text: 'Streaming...' },
      });

      expect(outputs).toHaveLength(1);
      expect(outputs[0].type).toBe('text');
      expect(outputs[0].content).toBe('Streaming...');
    });

    it('emits text and tool_call from assistant message with content blocks', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      (manager as any).handleMessage({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'Let me read that file.' },
            { type: 'tool_use', name: 'Read', id: 'tool-1', input: { path: '/a.ts' } },
          ],
        },
      });

      expect(outputs).toHaveLength(2);
      expect(outputs[0].type).toBe('text');
      expect(outputs[0].content).toBe('Let me read that file.');
      expect(outputs[1].type).toBe('tool_call');
      expect(outputs[1].metadata?.toolName).toBe('Read');
    });

    it('suppresses assistant text when text_delta already streamed this turn', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      (manager as any).handleMessage({
        type: 'content_block_delta',
        delta: { type: 'text_delta', text: 'You are on main.' },
      });
      (manager as any).handleMessage({
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'You are on main.' }] },
      });

      expect(outputs).toHaveLength(1);
      expect(outputs[0].type).toBe('text');
      expect(outputs[0].content).toBe('You are on main.');
    });

    it('suppresses duplicate assistant text when assistant message repeats', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      const assistantMessage = {
        type: 'assistant',
        message: { content: [{ type: 'text', text: "You're on `monitor-pipeline-stability`." }] },
      };

      (manager as any).handleMessage(assistantMessage);
      (manager as any).handleMessage(assistantMessage);

      expect(outputs).toHaveLength(1);
      expect(outputs[0].type).toBe('text');
      expect(outputs[0].content).toBe("You're on `monitor-pipeline-stability`.");
    });

    it('still emits tool_call from assistant after text_delta', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      (manager as any).handleMessage({
        type: 'content_block_delta',
        delta: { type: 'text_delta', text: 'Checking...' },
      });
      (manager as any).handleMessage({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'Checking...' },
            { type: 'tool_use', name: 'Read', id: 'tool-1', input: { path: '/a.ts' } },
          ],
        },
      });

      expect(outputs).toHaveLength(2);
      expect(outputs[0].type).toBe('text');
      expect(outputs[1].type).toBe('tool_call');
      expect(outputs[1].metadata?.toolName).toBe('Read');
    });

    it('emits text from result message', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      (manager as any).handleMessage({ type: 'result', result: 'Task completed.' });

      expect(outputs).toHaveLength(1);
      expect(outputs[0].type).toBe('text');
      expect(outputs[0].content).toBe('Task completed.');
    });

    it('does not emit duplicate text from result when assistant already emitted same content', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      (manager as any).handleMessage({
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'You are on main.' }] },
      });
      (manager as any).handleMessage({ type: 'result', result: 'You are on main.' });

      expect(outputs).toHaveLength(1);
      expect(outputs[0].type).toBe('text');
      expect(outputs[0].content).toBe('You are on main.');
    });

    it('does not emit duplicate text from result when content_block_delta already emitted same content', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      (manager as any).handleMessage({
        type: 'content_block_delta',
        delta: { type: 'text_delta', text: 'You are on main.' },
      });
      (manager as any).handleMessage({ type: 'result', result: 'You are on main.' });

      expect(outputs).toHaveLength(1);
      expect(outputs[0].type).toBe('text');
      expect(outputs[0].content).toBe('You are on main.');
    });

    it('ignores result message without result text', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      (manager as any).handleMessage({ type: 'result' });

      expect(outputs).toHaveLength(0);
    });

    it('emits status text from thinking deltas', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      (manager as any).handleMessage({ type: 'thinking', subtype: 'delta', text: 'Planning...' });

      expect(outputs).toHaveLength(1);
      expect(outputs[0].type).toBe('status');
      expect(outputs[0].content).toBe('Planning...');
    });
  });

  describe('watchdog', () => {
    it('triggers after timeout with no output', () => {
      const outputs: any[] = [];
      const errors: Error[] = [];
      manager.on('output', (o) => outputs.push(o));
      manager.on('error', (e) => errors.push(e));

      // Start the watchdog
      (manager as any).resetWatchdog();

      // Advance past the timeout
      vi.advanceTimersByTime(6000);

      // Should emit watchdog status but not error/kill the process
      expect(outputs.some((o) => o.content.includes('Still waiting for Cursor output'))).toBe(true);
      expect(errors).toHaveLength(0);
    });

    it('does not trigger if cleared before timeout', () => {
      const errors: Error[] = [];
      manager.on('error', (e) => errors.push(e));

      (manager as any).resetWatchdog();
      (manager as any).clearWatchdog();

      vi.advanceTimersByTime(10000);

      expect(errors).toHaveLength(0);
    });

    it('resets on each call to resetWatchdog', () => {
      const outputs: any[] = [];
      const errors: Error[] = [];
      manager.on('output', (o) => outputs.push(o));
      manager.on('error', (e) => errors.push(e));

      (manager as any).resetWatchdog();
      vi.advanceTimersByTime(4000); // 4s, not yet 5s
      (manager as any).resetWatchdog(); // Reset
      vi.advanceTimersByTime(4000); // Another 4s from reset, total < 5s since last reset

      expect(errors).toHaveLength(0);

      // Now let it expire
      vi.advanceTimersByTime(2000); // 6s since last reset

      expect(outputs.some((o) => o.content.includes('Still waiting for Cursor output'))).toBe(true);
      expect(errors).toHaveLength(0);
    });
  });

  describe('stop', () => {
    it('sets status to stopped', async () => {
      await manager.stop();
      expect(manager.status).toBe('stopped');
    });

    it('clears watchdog timer on stop', async () => {
      (manager as any).resetWatchdog();
      expect((manager as any).watchdogTimer).not.toBeNull();

      await manager.stop();
      expect((manager as any).watchdogTimer).toBeNull();
    });
  });
});
