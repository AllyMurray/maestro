import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { logger } from './logger';

const execFileAsync = promisify(execFile);

export interface WorktreeInfo {
  path: string;
  branch: string;
  head: string;
  isMain: boolean;
}

async function git(repoPath: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd: repoPath });
  return stdout.trim();
}

export async function createWorktree(
  repoPath: string,
  branchName: string,
  worktreePath: string,
): Promise<string> {
  logger.info(`Creating worktree: ${branchName} at ${worktreePath}`);

  // Check if branch already exists
  try {
    await git(repoPath, 'rev-parse', '--verify', branchName);
    // Branch exists, create worktree from it
    await git(repoPath, 'worktree', 'add', worktreePath, branchName);
  } catch {
    // Branch doesn't exist, create new branch
    await git(repoPath, 'worktree', 'add', '-b', branchName, worktreePath);
  }

  logger.info(`Worktree created: ${worktreePath}`);
  return worktreePath;
}

export async function removeWorktree(repoPath: string, worktreePath: string): Promise<void> {
  logger.info(`Removing worktree: ${worktreePath}`);
  await git(repoPath, 'worktree', 'remove', worktreePath, '--force');
  logger.info(`Worktree removed: ${worktreePath}`);
}

export async function listWorktrees(repoPath: string): Promise<WorktreeInfo[]> {
  const output = await git(repoPath, 'worktree', 'list', '--porcelain');
  const worktrees: WorktreeInfo[] = [];
  let current: Partial<WorktreeInfo> = {};

  for (const line of output.split('\n')) {
    if (line.startsWith('worktree ')) {
      current.path = line.substring(9);
    } else if (line.startsWith('HEAD ')) {
      current.head = line.substring(5);
    } else if (line.startsWith('branch ')) {
      const ref = line.substring(7);
      current.branch = ref.replace('refs/heads/', '');
    } else if (line === 'bare') {
      current.isMain = true;
    } else if (line === '') {
      if (current.path) {
        worktrees.push({
          path: current.path,
          branch: current.branch || 'detached',
          head: current.head || '',
          isMain: current.isMain || worktrees.length === 0,
        });
      }
      current = {};
    }
  }

  // Handle last entry
  if (current.path) {
    worktrees.push({
      path: current.path,
      branch: current.branch || 'detached',
      head: current.head || '',
      isMain: current.isMain || worktrees.length === 0,
    });
  }

  return worktrees;
}

export async function pruneWorktrees(repoPath: string): Promise<void> {
  await git(repoPath, 'worktree', 'prune');
}

export function getWorktreePath(repoPath: string, branchName: string): string {
  const sanitized = branchName.replace(/[^a-zA-Z0-9_-]/g, '-');
  return path.join(path.dirname(repoPath), `.maestro-worktrees`, path.basename(repoPath), sanitized);
}

export async function getDefaultBranch(repoPath: string): Promise<string> {
  try {
    const ref = await git(repoPath, 'symbolic-ref', 'refs/remotes/origin/HEAD');
    return ref.replace('refs/remotes/origin/', '');
  } catch {
    // Fallback: try common names
    for (const branch of ['main', 'master']) {
      try {
        await git(repoPath, 'rev-parse', '--verify', branch);
        return branch;
      } catch {
        continue;
      }
    }
    return 'main';
  }
}

export async function detectGitPlatform(
  repoPath: string,
): Promise<'github' | 'gitlab' | null> {
  try {
    const url = await git(repoPath, 'remote', 'get-url', 'origin');
    if (url.includes('github.com')) return 'github';
    if (url.includes('gitlab')) return 'gitlab';
    return null;
  } catch {
    return null;
  }
}
