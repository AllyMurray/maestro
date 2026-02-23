import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdtempSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';

const execFileAsync = promisify(execFile);

/**
 * Detect if a CLI is available on the system.
 */
export async function hasCommand(cmd: string, args: string[] = ['--version']): Promise<boolean> {
  try {
    await execFileAsync(cmd, args, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Creates a temporary git repo for integration tests.
 * Returns the path and a cleanup function.
 */
export function createTempGitRepo(): { path: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'maestro-test-'));
  execSync('git init', { cwd: dir, stdio: 'ignore' });
  execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'ignore' });
  execSync('git config user.name "Test"', { cwd: dir, stdio: 'ignore' });

  // Create initial commit
  writeFileSync(join(dir, 'README.md'), '# Test Repo\n');
  execSync('git add .', { cwd: dir, stdio: 'ignore' });
  execSync('git commit -m "Initial commit"', { cwd: dir, stdio: 'ignore' });

  return {
    path: dir,
    cleanup: () => {
      try {
        execSync(`rm -rf "${dir}"`, { stdio: 'ignore' });
      } catch {
        // Ignore cleanup errors
      }
    },
  };
}
