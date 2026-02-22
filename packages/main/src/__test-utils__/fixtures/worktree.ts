/** Git worktree list --porcelain output fixtures */

export const SINGLE_WORKTREE = [
  'worktree /path/to/repo',
  'HEAD abc1234def5678',
  'branch refs/heads/main',
  '',
].join('\n');

export const MULTIPLE_WORKTREES = [
  'worktree /path/to/repo',
  'HEAD abc1234def5678',
  'branch refs/heads/main',
  '',
  'worktree /path/to/.maestro-worktrees/repo/feature-branch',
  'HEAD def5678abc1234',
  'branch refs/heads/feature-branch',
  '',
].join('\n');

export const BARE_REPO = [
  'worktree /path/to/repo',
  'HEAD abc1234def5678',
  'bare',
  '',
  'worktree /path/to/worktree',
  'HEAD def5678abc1234',
  'branch refs/heads/dev',
  '',
].join('\n');

export const DETACHED_HEAD = [
  'worktree /path/to/repo',
  'HEAD abc1234def5678',
  'branch refs/heads/main',
  '',
  'worktree /path/to/worktree',
  'HEAD def5678abc1234',
  'detached',
  '',
].join('\n');
