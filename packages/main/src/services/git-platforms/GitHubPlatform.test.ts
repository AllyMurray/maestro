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

describe('GitHubPlatform', () => {
  beforeEach(() => {
    mockExecFile.mockReset();
    vi.resetModules();
  });

  describe('detect', () => {
    it('returns true for GitHub URLs', async () => {
      mockExecFile.mockResolvedValue({
        stdout: 'git@github.com:user/repo.git',
        stderr: '',
      });

      const { GitHubPlatform } = await import('./GitHubPlatform');
      const gh = new GitHubPlatform();
      expect(await gh.detect('/repo')).toBe(true);
    });

    it('returns false for non-GitHub URLs', async () => {
      mockExecFile.mockResolvedValue({
        stdout: 'git@gitlab.com:user/repo.git',
        stderr: '',
      });

      const { GitHubPlatform } = await import('./GitHubPlatform');
      const gh = new GitHubPlatform();
      expect(await gh.detect('/repo')).toBe(false);
    });

    it('returns false on error', async () => {
      mockExecFile.mockRejectedValue(new Error('no remote'));

      const { GitHubPlatform } = await import('./GitHubPlatform');
      const gh = new GitHubPlatform();
      expect(await gh.detect('/repo')).toBe(false);
    });
  });

  describe('createPR', () => {
    it('builds correct gh args and parses URL', async () => {
      mockExecFile.mockResolvedValue({
        stdout: 'https://github.com/user/repo/pull/42',
        stderr: '',
      });

      const { GitHubPlatform } = await import('./GitHubPlatform');
      const gh = new GitHubPlatform();
      const result = await gh.createPR('/repo', {
        title: 'Test PR',
        body: 'Description',
        baseBranch: 'main',
        headBranch: 'feat/test',
      });

      expect(result.url).toBe('https://github.com/user/repo/pull/42');
      expect(result.number).toBe('42');
      expect(result.title).toBe('Test PR');
    });

    it('adds --draft flag when draft is true', async () => {
      mockExecFile.mockResolvedValue({
        stdout: 'https://github.com/user/repo/pull/1',
        stderr: '',
      });

      const { GitHubPlatform } = await import('./GitHubPlatform');
      const gh = new GitHubPlatform();
      await gh.createPR('/repo', {
        title: 'Draft PR',
        body: 'WIP',
        baseBranch: 'main',
        headBranch: 'feat/wip',
        draft: true,
      });

      expect(mockExecFile).toHaveBeenCalledWith(
        'gh',
        expect.arrayContaining(['--draft']),
        expect.any(Object),
      );
    });
  });

  describe('getPR', () => {
    it('parses PR details from JSON', async () => {
      mockExecFile.mockResolvedValue({
        stdout: JSON.stringify({
          number: 42,
          title: 'My PR',
          body: 'Description',
          state: 'OPEN',
          url: 'https://github.com/user/repo/pull/42',
          author: { login: 'testuser' },
          baseRefName: 'main',
          headRefName: 'feat/test',
          mergeable: 'MERGEABLE',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
        }),
        stderr: '',
      });

      const { GitHubPlatform } = await import('./GitHubPlatform');
      const gh = new GitHubPlatform();
      const pr = await gh.getPR('/repo', '42');

      expect(pr.number).toBe('42');
      expect(pr.title).toBe('My PR');
      expect(pr.author).toBe('testuser');
      expect(pr.mergeable).toBe(true);
      expect(pr.baseBranch).toBe('main');
      expect(pr.headBranch).toBe('feat/test');
    });

    it('handles non-mergeable PR', async () => {
      mockExecFile.mockResolvedValue({
        stdout: JSON.stringify({
          number: 1,
          title: 'Conflict PR',
          body: '',
          state: 'OPEN',
          url: '',
          author: { login: 'user' },
          baseRefName: 'main',
          headRefName: 'feat',
          mergeable: 'CONFLICTING',
          createdAt: '',
          updatedAt: '',
        }),
        stderr: '',
      });

      const { GitHubPlatform } = await import('./GitHubPlatform');
      const gh = new GitHubPlatform();
      const pr = await gh.getPR('/repo', '1');
      expect(pr.mergeable).toBe(false);
    });
  });

  describe('mergePR', () => {
    it('uses --squash for squash strategy', async () => {
      mockExecFile.mockResolvedValue({ stdout: '', stderr: '' });

      const { GitHubPlatform } = await import('./GitHubPlatform');
      const gh = new GitHubPlatform();
      await gh.mergePR('/repo', '42', 'squash');

      expect(mockExecFile).toHaveBeenCalledWith(
        'gh',
        expect.arrayContaining(['--squash']),
        expect.any(Object),
      );
    });

    it('uses --rebase for rebase strategy', async () => {
      mockExecFile.mockResolvedValue({ stdout: '', stderr: '' });

      const { GitHubPlatform } = await import('./GitHubPlatform');
      const gh = new GitHubPlatform();
      await gh.mergePR('/repo', '42', 'rebase');

      expect(mockExecFile).toHaveBeenCalledWith(
        'gh',
        expect.arrayContaining(['--rebase']),
        expect.any(Object),
      );
    });

    it('uses --merge for merge strategy', async () => {
      mockExecFile.mockResolvedValue({ stdout: '', stderr: '' });

      const { GitHubPlatform } = await import('./GitHubPlatform');
      const gh = new GitHubPlatform();
      await gh.mergePR('/repo', '42', 'merge');

      expect(mockExecFile).toHaveBeenCalledWith(
        'gh',
        expect.arrayContaining(['--merge']),
        expect.any(Object),
      );
    });

    it('includes --delete-branch', async () => {
      mockExecFile.mockResolvedValue({ stdout: '', stderr: '' });

      const { GitHubPlatform } = await import('./GitHubPlatform');
      const gh = new GitHubPlatform();
      await gh.mergePR('/repo', '42', 'merge');

      expect(mockExecFile).toHaveBeenCalledWith(
        'gh',
        expect.arrayContaining(['--delete-branch']),
        expect.any(Object),
      );
    });
  });

  describe('getChecks', () => {
    it('maps check statuses correctly', async () => {
      mockExecFile.mockResolvedValue({
        stdout: JSON.stringify([
          { name: 'CI', state: 'COMPLETED', conclusion: 'SUCCESS', detailsUrl: 'https://ci.test', startedAt: null, completedAt: null },
          { name: 'Lint', state: 'IN_PROGRESS', conclusion: null, detailsUrl: null, startedAt: null, completedAt: null },
          { name: 'Deploy', state: 'PENDING', conclusion: null, detailsUrl: null, startedAt: null, completedAt: null },
        ]),
        stderr: '',
      });

      const { GitHubPlatform } = await import('./GitHubPlatform');
      const gh = new GitHubPlatform();
      const checks = await gh.getChecks('/repo', 'HEAD');

      expect(checks).toHaveLength(3);
      expect(checks[0].status).toBe('completed');
      expect(checks[0].conclusion).toBe('success');
      expect(checks[1].status).toBe('in_progress');
      expect(checks[2].status).toBe('in_progress');
    });

    it('returns empty array on error', async () => {
      mockExecFile.mockRejectedValue(new Error('no checks'));

      const { GitHubPlatform } = await import('./GitHubPlatform');
      const gh = new GitHubPlatform();
      const checks = await gh.getChecks('/repo', 'HEAD');
      expect(checks).toEqual([]);
    });
  });

  describe('searchIssues', () => {
    it('parses issue list', async () => {
      mockExecFile.mockResolvedValue({
        stdout: JSON.stringify([
          {
            number: 1,
            title: 'Bug report',
            body: 'Description',
            state: 'OPEN',
            url: 'https://github.com/user/repo/issues/1',
            labels: [{ name: 'bug' }],
          },
        ]),
        stderr: '',
      });

      const { GitHubPlatform } = await import('./GitHubPlatform');
      const gh = new GitHubPlatform();
      const issues = await gh.searchIssues('/repo', 'bug');

      expect(issues).toHaveLength(1);
      expect(issues[0].title).toBe('Bug report');
      expect(issues[0].labels).toEqual(['bug']);
    });
  });

  describe('listComments', () => {
    it('parses PR comments', async () => {
      mockExecFile.mockResolvedValue({
        stdout: JSON.stringify({
          comments: [
            { id: 'c1', body: 'Looks good!', author: { login: 'reviewer' }, createdAt: '2024-01-01T00:00:00Z' },
          ],
        }),
        stderr: '',
      });

      const { GitHubPlatform } = await import('./GitHubPlatform');
      const gh = new GitHubPlatform();
      const comments = await gh.listComments('/repo', '42');

      expect(comments).toHaveLength(1);
      expect(comments[0].body).toBe('Looks good!');
      expect(comments[0].author).toBe('reviewer');
    });
  });
});
