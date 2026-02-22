import { execFile } from 'child_process';
import { promisify } from 'util';
import type { GitStatus, GitFileStatus, DiffFile } from '@maestro/shared';
import { logger } from './logger';

const execFileAsync = promisify(execFile);

async function git(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd, timeout: 10000 });
  return stdout.trim();
}

export async function getGitStatus(workspacePath: string): Promise<GitStatus> {
  try {
    // Get branch info
    const branch = await git(workspacePath, 'rev-parse', '--abbrev-ref', 'HEAD');

    // Get ahead/behind counts
    let ahead = 0;
    let behind = 0;
    try {
      const upstreamStatus = await git(workspacePath, 'rev-list', '--left-right', '--count', `HEAD...@{upstream}`);
      const parts = upstreamStatus.split('\t');
      ahead = parseInt(parts[0], 10) || 0;
      behind = parseInt(parts[1], 10) || 0;
    } catch {
      // No upstream set
    }

    // Get file status
    const statusOutput = await git(workspacePath, 'status', '--porcelain=v1');
    const files: GitFileStatus[] = [];
    let hasConflicts = false;

    for (const line of statusOutput.split('\n')) {
      if (!line) continue;
      const staged = line[0];
      const unstaged = line[1];
      const filePath = line.substring(3).replace(/^"(.+)"$/, '$1');

      if (staged === 'U' || unstaged === 'U' || (staged === 'A' && unstaged === 'A') || (staged === 'D' && unstaged === 'D')) {
        hasConflicts = true;
      }

      let status: GitFileStatus['status'];
      const isStaged = staged !== ' ' && staged !== '?';

      if (staged === '?' || unstaged === '?') {
        status = 'untracked';
      } else if (staged === 'A') {
        status = 'added';
      } else if (staged === 'D' || unstaged === 'D') {
        status = 'deleted';
      } else if (staged === 'R') {
        status = 'renamed';
      } else {
        status = 'modified';
      }

      files.push({ path: filePath, status, staged: isStaged });
    }

    return { branch, ahead, behind, files, hasConflicts };
  } catch (err) {
    logger.error('Failed to get git status:', (err as Error).message);
    return {
      branch: 'unknown',
      ahead: 0,
      behind: 0,
      files: [],
      hasConflicts: false,
    };
  }
}

export async function getDiffFiles(workspacePath: string, base?: string): Promise<DiffFile[]> {
  const args = ['diff', '--numstat', '--diff-filter=ADMR'];
  if (base) {
    args.push(base);
  }
  const output = await git(workspacePath, ...args);
  if (!output) return [];

  // Also get name-status to determine file status (added/deleted/modified/renamed)
  const statusArgs = ['diff', '--name-status', '--diff-filter=ADMR'];
  if (base) {
    statusArgs.push(base);
  }
  const statusOutput = await git(workspacePath, ...statusArgs);
  const statusMap = new Map<string, DiffFile['status']>();
  for (const line of statusOutput.split('\n')) {
    if (!line) continue;
    const [code, ...rest] = line.split('\t');
    const filePath = rest[rest.length - 1]; // For renames, last entry is the new name
    const statusChar = code[0];
    const status: DiffFile['status'] =
      statusChar === 'A' ? 'added' :
      statusChar === 'D' ? 'deleted' :
      statusChar === 'R' ? 'renamed' : 'modified';
    statusMap.set(filePath, status);
  }

  return output.split('\n').filter(Boolean).map((line) => {
    const [add, del, ...pathParts] = line.split('\t');
    const filePath = pathParts.join('\t');
    return {
      path: filePath,
      status: statusMap.get(filePath) ?? 'modified',
      additions: add === '-' ? 0 : parseInt(add, 10),
      deletions: del === '-' ? 0 : parseInt(del, 10),
    };
  });
}

export async function getDiff(workspacePath: string, filePath?: string, staged = false): Promise<string> {
  const args = ['diff'];
  if (staged) args.push('--cached');
  if (filePath) args.push('--', filePath);
  return git(workspacePath, ...args);
}
