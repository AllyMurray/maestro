/** Codex CLI exec --json JSONL output fixtures */

export const THREAD_STARTED = JSON.stringify({
  type: 'thread.started',
  thread_id: 'thread-abc-123',
});

export const ITEM_AGENT_MESSAGE = JSON.stringify({
  type: 'item.completed',
  item: {
    type: 'agent_message',
    text: 'I will fix the bug in index.ts.',
  },
});

export const ITEM_COMMAND_EXECUTION = JSON.stringify({
  type: 'item.completed',
  item: {
    type: 'command_execution',
    command: '/bin/zsh -lc cat src/index.ts',
    aggregated_output: 'console.log("hello");\n',
    exit_code: 0,
  },
});

export const ITEM_FILE_CHANGE = JSON.stringify({
  type: 'item.completed',
  item: {
    type: 'file_change',
    file: 'src/index.ts',
    action: 'edit',
  },
});

export const TURN_COMPLETED = JSON.stringify({
  type: 'turn.completed',
});

export const ERROR_EVENT = JSON.stringify({
  type: 'error',
  message: 'Rate limit exceeded',
});

export const MULTI_LINE_STREAM = [
  THREAD_STARTED,
  ITEM_AGENT_MESSAGE,
  ITEM_COMMAND_EXECUTION,
  ITEM_FILE_CHANGE,
  TURN_COMPLETED,
].join('\n');
