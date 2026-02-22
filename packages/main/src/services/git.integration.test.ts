import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { createTempGitRepo } from '../__test-utils__/exec';

/**
 * These integration tests verify git operations work with real git repos.
 * They use raw git commands to verify behavior independently of the service layer,
 * since the service layer is tested via unit tests with mocked execFile.
 */
describe('Git Operations Integration', () => {
  let repo: { path: string; cleanup: () => void };

  beforeEach(() => {
    repo = createTempGitRepo();
  });

  afterEach(() => {
    repo.cleanup();
  });

  describe('git status operations', () => {
    it('clean repo shows no changes', () => {
      const output = execSync('git status --porcelain=v1', { cwd: repo.path, encoding: 'utf-8' }).trim();
      expect(output).toBe('');
    });

    it('detects untracked files', () => {
      writeFileSync(join(repo.path, 'new-file.ts'), 'console.log("new")');
      const output = execSync('git status --porcelain=v1', { cwd: repo.path, encoding: 'utf-8' }).trim();
      expect(output).toContain('??');
      expect(output).toContain('new-file.ts');
    });

    it('detects staged files', () => {
      writeFileSync(join(repo.path, 'staged.ts'), 'export default 1;');
      execSync('git add staged.ts', { cwd: repo.path });
      const output = execSync('git status --porcelain=v1', { cwd: repo.path, encoding: 'utf-8' }).trim();
      expect(output).toContain('A');
      expect(output).toContain('staged.ts');
    });

    it('detects modified files', () => {
      writeFileSync(join(repo.path, 'README.md'), '# Updated Content\n');
      const output = execSync('git status --porcelain=v1', { cwd: repo.path, encoding: 'utf-8' }).trim();
      expect(output).toContain('M');
      expect(output).toContain('README.md');
    });

    it('detects branch name', () => {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: repo.path, encoding: 'utf-8' }).trim();
      expect(['main', 'master']).toContain(branch);
    });
  });

  describe('git diff operations', () => {
    it('shows numstat for changes', () => {
      writeFileSync(join(repo.path, 'README.md'), '# Updated README\nNew content\nMore content\n');
      execSync('git add .', { cwd: repo.path });
      execSync('git commit -m "Update README"', { cwd: repo.path });

      const output = execSync('git diff --numstat HEAD~1', { cwd: repo.path, encoding: 'utf-8' }).trim();
      expect(output).toContain('README.md');
    });

    it('shows file diff', () => {
      writeFileSync(join(repo.path, 'README.md'), '# Changed\n');
      execSync('git add .', { cwd: repo.path });
      execSync('git commit -m "Change"', { cwd: repo.path });

      const diff = execSync('git diff HEAD~1 -- README.md', { cwd: repo.path, encoding: 'utf-8' });
      expect(diff).toContain('Changed');
    });
  });

  describe('worktree operations', () => {
    it('lists the main worktree', () => {
      const output = execSync('git worktree list --porcelain', { cwd: repo.path, encoding: 'utf-8' });
      expect(output).toContain('worktree');
      expect(output).toContain(repo.path);
    });

    it('can create and list a worktree', () => {
      const wtPath = join(repo.path, '..', 'test-worktree');
      execSync(`git worktree add -b test-branch "${wtPath}"`, { cwd: repo.path });

      const output = execSync('git worktree list --porcelain', { cwd: repo.path, encoding: 'utf-8' });
      expect(output).toContain('test-branch');

      // Cleanup
      execSync(`git worktree remove "${wtPath}" --force`, { cwd: repo.path });
    });
  });

  describe('worktreeManager pure functions', () => {
    it('getWorktreePath sanitizes branch names', async () => {
      const { getWorktreePath } = await import('./worktreeManager');
      const path = getWorktreePath(repo.path, 'feat/my-feature');
      expect(path).toContain('.maestro-worktrees');
      expect(path).not.toMatch(/\/feat\//);
    });

    it('getDefaultBranch detects the branch', async () => {
      const { getDefaultBranch } = await import('./worktreeManager');
      const branch = await getDefaultBranch(repo.path);
      expect(['main', 'master']).toContain(branch);
    });
  });
});
