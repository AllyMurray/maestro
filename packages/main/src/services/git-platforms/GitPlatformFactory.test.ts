import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExecFile = vi.fn();
vi.mock('child_process', () => ({
  execFile: (...args: any[]) => mockExecFile(...args),
  promisify: vi.fn(() => mockExecFile),
}));
vi.mock('util', () => ({
  promisify: vi.fn(() => mockExecFile),
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('GitPlatformFactory', () => {
  beforeEach(() => {
    mockExecFile.mockReset();
    vi.resetModules();
  });

  describe('createGitPlatform', () => {
    it('creates GitHub platform', async () => {
      const { createGitPlatform } = await import('./GitPlatformFactory');
      const platform = createGitPlatform('github');
      expect(platform.platform).toBe('github');
    });

    it('creates GitLab platform', async () => {
      const { createGitPlatform } = await import('./GitPlatformFactory');
      const platform = createGitPlatform('gitlab');
      expect(platform.platform).toBe('gitlab');
    });

    it('throws for unknown platform', async () => {
      const { createGitPlatform } = await import('./GitPlatformFactory');
      expect(() => createGitPlatform('bitbucket' as any)).toThrow('Unknown git platform');
    });
  });

  describe('detectGitPlatform', () => {
    it('detects GitHub repos', async () => {
      mockExecFile.mockResolvedValue({
        stdout: 'git@github.com:user/repo.git',
        stderr: '',
      });

      const { detectGitPlatform } = await import('./GitPlatformFactory');
      const platform = await detectGitPlatform('/repo');
      expect(platform).toBeDefined();
      expect(platform!.platform).toBe('github');
    });

    it('detects GitLab repos', async () => {
      mockExecFile.mockResolvedValue({
        stdout: 'git@gitlab.com:user/repo.git',
        stderr: '',
      });

      const { detectGitPlatform } = await import('./GitPlatformFactory');
      const platform = await detectGitPlatform('/repo');
      expect(platform).toBeDefined();
      expect(platform!.platform).toBe('gitlab');
    });

    it('returns null for unknown platforms', async () => {
      mockExecFile.mockResolvedValue({
        stdout: 'git@bitbucket.org:user/repo.git',
        stderr: '',
      });

      const { detectGitPlatform } = await import('./GitPlatformFactory');
      const platform = await detectGitPlatform('/repo');
      expect(platform).toBeNull();
    });
  });
});
