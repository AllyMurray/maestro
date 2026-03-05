export type AgentType = 'claude-code' | 'codex' | 'cursor';
export type GitPlatform = 'github' | 'gitlab';
export type WorkspaceStatus = 'backlog' | 'in_progress' | 'in_review' | 'done' | 'cancelled';
export type MergeStrategy = 'merge' | 'squash' | 'rebase';
export type MessageRole = 'user' | 'assistant' | 'tool_call' | 'tool_result';

export type SessionStatus =
  | 'initializing'
  | 'running'
  | 'waiting'
  | 'paused'
  | 'completed'
  | 'error';

export interface Project {
  id: string;
  name: string;
  path: string;
  gitPlatform: GitPlatform | null;
  defaultBranch: string;
  settingsJson: string;
  createdAt: string;
}

export interface Workspace {
  id: string;
  projectId: string;
  name: string;
  branchName: string;
  worktreePath: string | null;
  settingsJson?: string;
  agentType: AgentType;
  status: WorkspaceStatus;
  prNumber: string | null;
  prUrl: string | null;
  targetBranch: string;
  createdAt: string;
}

export interface Session {
  id: string;
  workspaceId: string;
  agentType: AgentType;
  agentSessionId: string | null;
  status: SessionStatus;
  model: string | null;
  createdAt: string;
}

export interface Message {
  id: number;
  sessionId: string;
  role: MessageRole;
  content: string;
  metadataJson: string;
  createdAt: string;
}

export interface Checkpoint {
  id: number;
  workspaceId: string;
  sessionId: string;
  commitHash: string;
  messageIndex: number | null;
  createdAt: string;
}

export interface Todo {
  id: number;
  workspaceId: string;
  title: string;
  isCompleted: boolean;
  blocksMerge: boolean;
  createdAt: string;
}

export interface LinkedIssue {
  id: number;
  workspaceId: string;
  source: GitPlatform;
  issueId: string;
  title: string | null;
  url: string | null;
  createdAt: string;
}

export interface DiffComment {
  id: number;
  workspaceId: string;
  filePath: string;
  lineNumber: number;
  body: string;
  isResolved: boolean;
  prCommentId: string | null;
  createdAt: string;
}

export interface ConfigEntry {
  key: string;
  value: string;
}

// Agent-related types
export interface AgentOpts {
  model?: string;
  apiKey?: string;
  permissions?: 'default' | 'skip';
  resumeSessionId?: string;
}

export interface AgentOutput {
  type: 'text' | 'tool_call' | 'tool_result' | 'status' | 'error';
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export type AgentStatus = 'idle' | 'starting' | 'running' | 'waiting' | 'stopped' | 'error';

// Git platform types
export interface CreatePROptions {
  title: string;
  body: string;
  baseBranch: string;
  headBranch: string;
  draft?: boolean;
}

export interface PRResult {
  number: string;
  url: string;
  title: string;
}

export interface PRDetails {
  number: string;
  title: string;
  body: string;
  state: string;
  url: string;
  author: string;
  baseBranch: string;
  headBranch: string;
  mergeable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PRComment {
  id: string;
  body: string;
  author: string;
  createdAt: string;
  path?: string;
  line?: number;
}

export interface CICheck {
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | null;
  url: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface Issue {
  id: string;
  number: string;
  title: string;
  body: string;
  state: string;
  url: string;
  labels: string[];
}

// Git status types
export interface GitFileStatus {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';
  staged: boolean;
}

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  files: GitFileStatus[];
  hasConflicts: boolean;
}

export interface DiffFile {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
}

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

// IPC type helpers
export interface IpcRequest<T = unknown> {
  channel: string;
  data: T;
}

export interface IpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
