export const APP_NAME = 'Maestro';
export const APP_ID = 'com.maestro.app';

export const DATA_DIR_NAME = '.maestro';
export const DB_FILENAME = 'maestro.db';
export const CONFIG_FILENAME = 'config.json';
export const LOG_DIR_NAME = 'logs';

export const AGENT_TYPES = ['claude-code', 'codex', 'cursor'] as const;

export const WORKSPACE_STATUSES = [
  'backlog',
  'in_progress',
  'in_review',
  'done',
  'cancelled',
] as const;

export const SESSION_STATUSES = [
  'initializing',
  'running',
  'waiting',
  'paused',
  'completed',
  'error',
] as const;

export const MESSAGE_ROLES = ['user', 'assistant', 'tool_call', 'tool_result'] as const;

export const GIT_PLATFORMS = ['github', 'gitlab'] as const;

export const MERGE_STRATEGIES = ['merge', 'squash', 'rebase'] as const;

export const IPC_CHANNELS = {
  // Config
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
  CONFIG_GET_ALL: 'config:get-all',

  // Projects
  PROJECT_CREATE: 'project:create',
  PROJECT_LIST: 'project:list',
  PROJECT_GET: 'project:get',
  PROJECT_DELETE: 'project:delete',
  PROJECT_UPDATE: 'project:update',

  // Workspaces
  WORKSPACE_CREATE: 'workspace:create',
  WORKSPACE_LIST: 'workspace:list',
  WORKSPACE_GET: 'workspace:get',
  WORKSPACE_DELETE: 'workspace:delete',
  WORKSPACE_UPDATE_STATUS: 'workspace:update-status',
  WORKSPACE_UPDATE_SETTINGS: 'workspace:update-settings',

  // Sessions
  SESSION_CREATE: 'session:create',
  SESSION_GET: 'session:get',
  SESSION_LIST: 'session:list',
  SESSION_CLEAR: 'session:clear',

  // Agent
  AGENT_START: 'agent:start',
  AGENT_SEND: 'agent:send',
  AGENT_STOP: 'agent:stop',
  AGENT_STATUS: 'agent:status',
  AGENT_OUTPUT: 'agent:output',
  AGENT_LIST_AVAILABLE: 'agent:list-available',

  // Terminal
  TERMINAL_CREATE: 'terminal:create',
  TERMINAL_WRITE: 'terminal:write',
  TERMINAL_RESIZE: 'terminal:resize',
  TERMINAL_CLOSE: 'terminal:close',
  TERMINAL_DATA: 'terminal:data',

  // Git
  GIT_STATUS: 'git:status',
  GIT_DIFF: 'git:diff',
  GIT_DIFF_FILES: 'git:diff-files',

  // Git Platform (PR/MR)
  PR_CREATE: 'pr:create',
  PR_GET: 'pr:get',
  PR_MERGE: 'pr:merge',
  PR_LIST_COMMENTS: 'pr:list-comments',
  PR_GET_CHECKS: 'pr:get-checks',

  // Issues
  ISSUE_SEARCH: 'issue:search',
  ISSUE_LINK: 'issue:link',
  ISSUE_UNLINK: 'issue:unlink',

  // Checkpoints
  CHECKPOINT_CREATE: 'checkpoint:create',
  CHECKPOINT_LIST: 'checkpoint:list',
  CHECKPOINT_REVERT: 'checkpoint:revert',

  // Messages
  MESSAGE_LIST: 'message:list',

  // Todos
  TODO_CREATE: 'todo:create',
  TODO_LIST: 'todo:list',
  TODO_UPDATE: 'todo:update',
  TODO_DELETE: 'todo:delete',

  // Diff comments
  DIFF_COMMENT_CREATE: 'diff-comment:create',
  DIFF_COMMENT_LIST: 'diff-comment:list',
  DIFF_COMMENT_RESOLVE: 'diff-comment:resolve',

  // Files
  FILE_LIST_DIR: 'file:list-dir',

  // Dialog
  DIALOG_SELECT_DIRECTORY: 'dialog:select-directory',
} as const;
