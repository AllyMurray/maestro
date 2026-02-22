/** Claude Code stream-json output fixtures */

export const SYSTEM_MESSAGE = JSON.stringify({
  type: 'system',
  session_id: 'test-session-123',
  tools: ['Read', 'Write', 'Bash'],
});

export const ASSISTANT_TEXT = JSON.stringify({
  type: 'assistant',
  message: {
    content: [
      { type: 'text', text: 'Hello, I can help with that.' },
    ],
  },
});

export const ASSISTANT_TOOL_USE = JSON.stringify({
  type: 'assistant',
  message: {
    content: [
      { type: 'text', text: 'Let me read that file.' },
      {
        type: 'tool_use',
        id: 'tool-123',
        name: 'Read',
        input: { file_path: '/src/index.ts' },
      },
    ],
  },
});

export const CONTENT_BLOCK_DELTA = JSON.stringify({
  type: 'content_block_delta',
  delta: { type: 'text_delta', text: 'Streaming text...' },
});

export const RESULT_MESSAGE = JSON.stringify({
  type: 'result',
  result: 'Task completed successfully.',
  session_id: 'test-session-123',
});

export const MULTI_LINE_STREAM = [
  SYSTEM_MESSAGE,
  ASSISTANT_TEXT,
  RESULT_MESSAGE,
].join('\n');
