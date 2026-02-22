import { execFile } from 'child_process';
import { promisify } from 'util';
import type { DiffFile } from '@maestro/shared';
import { logger } from './logger';

const execFileAsync = promisify(execFile);

async function git(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd, timeout: 10000 });
  return stdout.trim();
}

export async function getDiffFiles(
  workspacePath: string,
  base?: string,
): Promise<DiffFile[]> {
  const args = ['diff', '--numstat'];
  if (base) {
    args.push(base);
  }

  const output = await git(workspacePath, ...args);
  if (!output) return [];

  const files: DiffFile[] = [];
  for (const line of output.split('\n')) {
    const [adds, dels, path] = line.split('\t');
    if (!path) continue;

    // Determine status
    let status: DiffFile['status'] = 'modified';
    try {
      const diffOutput = await git(workspacePath, 'diff', '--diff-filter=ADRM', '--name-status', base || '', '--', path);
      if (diffOutput) {
        const statusChar = diffOutput.charAt(0);
        switch (statusChar) {
          case 'A': status = 'added'; break;
          case 'D': status = 'deleted'; break;
          case 'R': status = 'renamed'; break;
        }
      }
    } catch {
      // Default to modified
    }

    files.push({
      path,
      status,
      additions: adds === '-' ? 0 : parseInt(adds, 10),
      deletions: dels === '-' ? 0 : parseInt(dels, 10),
    });
  }

  return files;
}

export async function getFileDiff(
  workspacePath: string,
  filePath: string,
  base?: string,
): Promise<string> {
  const args = ['diff'];
  if (base) args.push(base);
  args.push('--', filePath);

  return git(workspacePath, ...args);
}

export async function getFileContent(
  workspacePath: string,
  filePath: string,
  ref = 'HEAD',
): Promise<string> {
  try {
    return await git(workspacePath, 'show', `${ref}:${filePath}`);
  } catch {
    return '';
  }
}

export async function getWorkingFileContent(
  workspacePath: string,
  filePath: string,
): Promise<string> {
  const fs = await import('fs');
  const path = await import('path');
  const fullPath = path.join(workspacePath, filePath);
  try {
    return fs.readFileSync(fullPath, 'utf-8');
  } catch {
    return '';
  }
}
