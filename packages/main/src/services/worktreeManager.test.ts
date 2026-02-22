import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fixtures from '../__test-utils__/fixtures/worktree';

const mockExecFile = vi.fn();
vi.mock('child_process', () => ({
  execFile: (...args: any[]) => mockExecFile(...args),
  promisify: vi.fn(() => mockExecFile),
}));
vi.mock('util', () => ({
  promisify: vi.fn(() => mockExecFile),
}));

vi.mock('./logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('worktreeManager', () => {
  beforeEach(() => {
    mockExecFile.mockReset();
    vi.resetModules();
  });

  describe('listWorktrees', () => {
    it('parses single worktree', async () => {
      mockExecFile.mockResolvedValue({ stdout: fixtures.SINGLE_WORKTREE, stderr: '' });

      const { listWorktrees } = await import('./worktreeManager');
      const worktrees = await listWorktrees('/repo');
      expect(worktrees).toHaveLength(1);
      expect(worktrees[0].path).toBe('/path/to/repo');
      expect(worktrees[0].branch).toBe('main');
      expect(worktrees[0].head).toBe('abc1234def5678');
      expect(worktrees[0].isMain).toBe(true);
    });

    it('parses multiple worktrees', async () => {
      mockExecFile.mockResolvedValue({ stdout: fixtures.MULTIPLE_WORKTREES, stderr: '' });

      const { listWorktrees } = await import('./worktreeManager');
      const worktrees = await listWorktrees('/repo');
      expect(worktrees).toHaveLength(2);
      expect(worktrees[0].isMain).toBe(true);
      expect(worktrees[1].branch).toBe('feature-branch');
      expect(worktrees[1].isMain).toBe(false);
    });

    it('handles bare repo', async () => {
      mockExecFile.mockResolvedValue({ stdout: fixtures.BARE_REPO, stderr: '' });

      const { listWorktrees } = await import('./worktreeManager');
      const worktrees = await listWorktrees('/repo');
      expect(worktrees).toHaveLength(2);
      expect(worktrees[0].isMain).toBe(true);
    });

    it('handles detached HEAD', async () => {
      mockExecFile.mockResolvedValue({ stdout: fixtures.DETACHED_HEAD, stderr: '' });

      const { listWorktrees } = await import('./worktreeManager');
      const worktrees = await listWorktrees('/repo');
      expect(worktrees).toHaveLength(2);
      expect(worktrees[1].branch).toBe('detached');
    });
  });

  describe('getWorktreePath', () => {
    it('sanitizes branch names', async () => {
      const { getWorktreePath } = await import('./worktreeManager');

      const result = getWorktreePath('/path/to/repo', 'feat/my-feature');
      expect(result).toContain('.maestro-worktrees');
      expect(result).toContain('repo');
      expect(result).toContain('feat-my-feature');
      expect(result).not.toContain('/feat/');
    });

    it('handles simple branch names', async () => {
      const { getWorktreePath } = await import('./worktreeManager');
      const result = getWorktreePath('/path/to/repo', 'main');
      expect(result).toContain('main');
    });

    it('replaces special characters', async () => {
      const { getWorktreePath } = await import('./worktreeManager');
      const result = getWorktreePath('/repo', 'feat/special@chars!here');
      expect(result).not.toMatch(/[@!]/);
    });
  });

  describe('detectGitPlatform', () => {
    it('detects GitHub', async () => {
      mockExecFile.mockResolvedValue({
        stdout: 'git@github.com:user/repo.git',
        stderr: '',
      });

      const { detectGitPlatform } = await import('./worktreeManager');
      const platform = await detectGitPlatform('/repo');
      expect(platform).toBe('github');
    });

    it('detects GitLab', async () => {
      mockExecFile.mockResolvedValue({
        stdout: 'git@gitlab.com:user/repo.git',
        stderr: '',
      });

      const { detectGitPlatform } = await import('./worktreeManager');
      const platform = await detectGitPlatform('/repo');
      expect(platform).toBe('gitlab');
    });

    it('returns null for unknown platforms', async () => {
      mockExecFile.mockResolvedValue({
        stdout: 'git@bitbucket.org:user/repo.git',
        stderr: '',
      });

      const { detectGitPlatform } = await import('./worktreeManager');
      const platform = await detectGitPlatform('/repo');
      expect(platform).toBeNull();
    });

    it('returns null on error', async () => {
      mockExecFile.mockRejectedValue(new Error('no remote'));

      const { detectGitPlatform } = await import('./worktreeManager');
      const platform = await detectGitPlatform('/repo');
      expect(platform).toBeNull();
    });
  });

  describe('getDefaultBranch', () => {
    it('returns branch from symbolic ref', async () => {
      mockExecFile.mockResolvedValue({
        stdout: 'refs/remotes/origin/main',
        stderr: '',
      });

      const { getDefaultBranch } = await import('./worktreeManager');
      const branch = await getDefaultBranch('/repo');
      expect(branch).toBe('main');
    });

    it('falls back to main when symbolic ref fails', async () => {
      let callCount = 0;
      mockExecFile.mockImplementation((...args: any[]) => {
        const gitArgs = args[1] as string[];
        if (gitArgs.includes('symbolic-ref')) {
          return Promise.reject(new Error('no ref'));
        }
        if (gitArgs.includes('rev-parse') && gitArgs.includes('main')) {
          return Promise.resolve({ stdout: 'abc123', stderr: '' });
        }
        return Promise.reject(new Error('not found'));
      });

      const { getDefaultBranch } = await import('./worktreeManager');
      const branch = await getDefaultBranch('/repo');
      expect(branch).toBe('main');
    });

    it('falls back to master when main does not exist', async () => {
      mockExecFile.mockImplementation((...args: any[]) => {
        const gitArgs = args[1] as string[];
        if (gitArgs.includes('symbolic-ref')) {
          return Promise.reject(new Error('no ref'));
        }
        if (gitArgs.includes('main')) {
          return Promise.reject(new Error('not found'));
        }
        if (gitArgs.includes('master')) {
          return Promise.resolve({ stdout: 'abc123', stderr: '' });
        }
        return Promise.reject(new Error('not found'));
      });

      const { getDefaultBranch } = await import('./worktreeManager');
      const branch = await getDefaultBranch('/repo');
      expect(branch).toBe('master');
    });

    it('defaults to main when no branches exist', async () => {
      mockExecFile.mockRejectedValue(new Error('no branches'));

      const { getDefaultBranch } = await import('./worktreeManager');
      const branch = await getDefaultBranch('/repo');
      expect(branch).toBe('main');
    });
  });
});
