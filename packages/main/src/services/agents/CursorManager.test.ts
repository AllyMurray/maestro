import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CursorManager } from './CursorManager';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('CursorManager', () => {
  let manager: CursorManager;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new CursorManager(5000); // Short watchdog for testing
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('has correct type and display name', () => {
    expect(manager.type).toBe('cursor');
    expect(manager.displayName).toBe('Cursor');
    expect(manager.command).toBe('cursor');
  });

  it('starts with idle status', () => {
    expect(manager.status).toBe('idle');
  });

  it('emits status events when status changes', async () => {
    const statuses: string[] = [];
    manager.on('status', (s) => statuses.push(s));

    await manager.start('/test', {});
    expect(statuses).toContain('starting');
    expect(statuses).toContain('running');
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

    it('emits text from result message', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      (manager as any).handleMessage({ type: 'result', result: 'Task completed.' });

      expect(outputs).toHaveLength(1);
      expect(outputs[0].type).toBe('text');
      expect(outputs[0].content).toBe('Task completed.');
    });

    it('ignores result message without result text', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      (manager as any).handleMessage({ type: 'result' });

      expect(outputs).toHaveLength(0);
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

      // Should have emitted a status output and an error
      expect(outputs.some((o) => o.content.includes('Watchdog'))).toBe(true);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('timed out');
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
      const errors: Error[] = [];
      manager.on('error', (e) => errors.push(e));

      (manager as any).resetWatchdog();
      vi.advanceTimersByTime(4000); // 4s, not yet 5s
      (manager as any).resetWatchdog(); // Reset
      vi.advanceTimersByTime(4000); // Another 4s from reset, total < 5s since last reset

      expect(errors).toHaveLength(0);

      // Now let it expire
      vi.advanceTimersByTime(2000); // 6s since last reset

      expect(errors).toHaveLength(1);
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
