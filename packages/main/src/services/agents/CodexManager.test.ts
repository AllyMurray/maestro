import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CodexManager } from './CodexManager';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('CodexManager', () => {
  let manager: CodexManager;

  beforeEach(() => {
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

      (manager as any).buffer = '{"type":"message","content":"Hello"}\n';
      (manager as any).processBuffer();

      expect(outputs).toHaveLength(1);
      expect(outputs[0].type).toBe('text');
      expect(outputs[0].content).toBe('Hello');
    });

    it('keeps incomplete lines in buffer', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      (manager as any).buffer = '{"type":"message","content":';
      (manager as any).processBuffer();

      expect(outputs).toHaveLength(0);
      expect((manager as any).buffer).toBe('{"type":"message","content":');
    });

    it('emits plain text for non-JSON lines', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      (manager as any).buffer = 'Some plain text output\n';
      (manager as any).processBuffer();

      expect(outputs).toHaveLength(1);
      expect(outputs[0].type).toBe('text');
      expect(outputs[0].content).toBe('Some plain text output');
    });

    it('skips empty lines', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      (manager as any).buffer = '\n  \n{"type":"message","content":"hi"}\n';
      (manager as any).processBuffer();

      expect(outputs).toHaveLength(1);
      expect(outputs[0].content).toBe('hi');
    });

    it('handles multiple lines in one buffer', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      (manager as any).buffer =
        '{"type":"message","content":"first"}\n{"type":"message","content":"second"}\n';
      (manager as any).processBuffer();

      expect(outputs).toHaveLength(2);
      expect(outputs[0].content).toBe('first');
      expect(outputs[1].content).toBe('second');
    });
  });

  describe('handleMessage', () => {
    it('emits text from message type', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      (manager as any).handleMessage({ type: 'message', content: 'Hello from Codex' });

      expect(outputs).toHaveLength(1);
      expect(outputs[0].type).toBe('text');
      expect(outputs[0].content).toBe('Hello from Codex');
    });

    it('ignores message type with no content', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      (manager as any).handleMessage({ type: 'message' });

      expect(outputs).toHaveLength(0);
    });

    it('emits tool_call from function_call type', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      const msg = { type: 'function_call', name: 'shell', arguments: '{"cmd":"ls"}' };
      (manager as any).handleMessage(msg);

      expect(outputs).toHaveLength(1);
      expect(outputs[0].type).toBe('tool_call');
      expect(outputs[0].metadata?.toolName).toBe('shell');
    });

    it('emits tool_result from function_call_output type', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      const msg = { type: 'function_call_output', name: 'shell', output: 'file1.ts\nfile2.ts' };
      (manager as any).handleMessage(msg);

      expect(outputs).toHaveLength(1);
      expect(outputs[0].type).toBe('tool_result');
      expect(outputs[0].content).toBe('file1.ts\nfile2.ts');
      expect(outputs[0].metadata?.toolName).toBe('shell');
    });

    it('emits text from unknown type with content', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      (manager as any).handleMessage({ type: 'unknown', content: 'raw content' });

      expect(outputs).toHaveLength(1);
      expect(outputs[0].type).toBe('text');
      expect(outputs[0].content).toBe('raw content');
    });

    it('ignores unknown type with no content', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      (manager as any).handleMessage({ type: 'unknown' });

      expect(outputs).toHaveLength(0);
    });
  });

  describe('stop', () => {
    it('sets status to stopped', async () => {
      await manager.stop();
      expect(manager.status).toBe('stopped');
    });
  });
});
