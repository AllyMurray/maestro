import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Creates a temporary git repo inside `baseDir` with an initial commit.
 * Needed for PROJECT_CREATE which calls `getDefaultBranch()` (runs real git commands).
 */
export function createTempGitRepo(baseDir: string, name = 'test-repo'): string {
  const repoPath = path.join(baseDir, name);
  fs.mkdirSync(repoPath, { recursive: true });

  execSync('git init', { cwd: repoPath, stdio: 'ignore' });
  execSync('git config user.email "test@test.com"', { cwd: repoPath, stdio: 'ignore' });
  execSync('git config user.name "Test"', { cwd: repoPath, stdio: 'ignore' });

  fs.writeFileSync(path.join(repoPath, 'README.md'), '# Test repo\n');
  execSync('git add . && git commit -m "init"', { cwd: repoPath, stdio: 'ignore' });

  return repoPath;
}
