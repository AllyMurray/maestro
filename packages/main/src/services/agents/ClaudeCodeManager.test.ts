import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeCodeManager } from './ClaudeCodeManager';
import * as fixtures from '../../__test-utils__/fixtures/claude-stream';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('ClaudeCodeManager', () => {
  let manager: ClaudeCodeManager;

  beforeEach(() => {
    manager = new ClaudeCodeManager();
  });

  it('has correct type and display name', () => {
    expect(manager.type).toBe('claude-code');
    expect(manager.displayName).toBe('Claude Code');
    expect(manager.command).toBe('claude');
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

  describe('processBuffer (via handleMessage)', () => {
    it('emits session_id from system message', () => {
      let receivedId: string | undefined;
      manager.on('session_id', (id) => {
        receivedId = id;
      });

      // Access private method through casting
      const msg = JSON.parse(fixtures.SYSTEM_MESSAGE);
      (manager as any).handleMessage(msg);

      expect(receivedId).toBe('test-session-123');
    });

    it('emits text output from assistant message', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      const msg = JSON.parse(fixtures.ASSISTANT_TEXT);
      (manager as any).handleMessage(msg);

      expect(outputs).toHaveLength(1);
      expect(outputs[0].type).toBe('text');
      expect(outputs[0].content).toBe('Hello, I can help with that.');
    });

    it('emits text and tool_call from mixed assistant message', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      const msg = JSON.parse(fixtures.ASSISTANT_TOOL_USE);
      (manager as any).handleMessage(msg);

      expect(outputs).toHaveLength(2);
      expect(outputs[0].type).toBe('text');
      expect(outputs[1].type).toBe('tool_call');
      expect(outputs[1].metadata?.toolName).toBe('Read');
      expect(outputs[1].metadata?.toolId).toBe('tool-123');
    });

    it('emits text from content_block_delta', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      const msg = JSON.parse(fixtures.CONTENT_BLOCK_DELTA);
      (manager as any).handleMessage(msg);

      expect(outputs).toHaveLength(1);
      expect(outputs[0].type).toBe('text');
      expect(outputs[0].content).toBe('Streaming text...');
    });

    it('emits text and session_id from result message', () => {
      const outputs: any[] = [];
      let sessionId: string | undefined;
      manager.on('output', (o) => outputs.push(o));
      manager.on('session_id', (id) => {
        sessionId = id;
      });

      const msg = JSON.parse(fixtures.RESULT_MESSAGE);
      (manager as any).handleMessage(msg);

      expect(outputs).toHaveLength(1);
      expect(outputs[0].content).toBe('Task completed successfully.');
      expect(sessionId).toBe('test-session-123');
    });
  });

  describe('processBuffer', () => {
    it('processes complete JSON lines', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      // Simulate buffer processing
      (manager as any).buffer = fixtures.ASSISTANT_TEXT + '\n';
      (manager as any).processBuffer();

      expect(outputs).toHaveLength(1);
    });

    it('keeps incomplete lines in buffer', () => {
      const outputs: any[] = [];
      manager.on('output', (o) => outputs.push(o));

      // Partial JSON line
      (manager as any).buffer = '{"type": "assistant", "message":';
      (manager as any).processBuffer();

      // Nothing should be emitted
      expect(outputs).toHaveLength(0);
      // Buffer should retain the incomplete data
      expect((manager as any).buffer).toBe('{"type": "assistant", "message":');
    });

    it('handles multiple lines in one buffer', () => {
      const outputs: any[] = [];
      let sessionId: string | undefined;
      manager.on('output', (o) => outputs.push(o));
      manager.on('session_id', (id) => {
        sessionId = id;
      });

      (manager as any).buffer = fixtures.MULTI_LINE_STREAM + '\n';
      (manager as any).processBuffer();

      // system message emits session_id, assistant emits text, result emits text
      expect(sessionId).toBe('test-session-123');
      expect(outputs.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('stop', () => {
    it('sets status to stopped', async () => {
      await manager.stop();
      expect(manager.status).toBe('stopped');
    });
  });
});
