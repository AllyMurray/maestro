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

describe('GitLabPlatform', () => {
  beforeEach(() => {
    mockExecFile.mockReset();
    vi.resetModules();
  });

  describe('detect', () => {
    it('returns true for GitLab URLs', async () => {
      mockExecFile.mockResolvedValue({
        stdout: 'git@gitlab.com:user/repo.git',
        stderr: '',
      });

      const { GitLabPlatform } = await import('./GitLabPlatform');
      const gl = new GitLabPlatform();
      expect(await gl.detect('/repo')).toBe(true);
    });

    it('returns false for non-GitLab URLs', async () => {
      mockExecFile.mockResolvedValue({
        stdout: 'git@github.com:user/repo.git',
        stderr: '',
      });

      const { GitLabPlatform } = await import('./GitLabPlatform');
      const gl = new GitLabPlatform();
      expect(await gl.detect('/repo')).toBe(false);
    });

    it('returns false on error', async () => {
      mockExecFile.mockRejectedValue(new Error('no remote'));

      const { GitLabPlatform } = await import('./GitLabPlatform');
      const gl = new GitLabPlatform();
      expect(await gl.detect('/repo')).toBe(false);
    });
  });

  describe('createPR', () => {
    it('builds correct glab args and parses URL', async () => {
      mockExecFile.mockResolvedValue({
        stdout: 'https://gitlab.com/user/repo/-/merge_requests/7',
        stderr: '',
      });

      const { GitLabPlatform } = await import('./GitLabPlatform');
      const gl = new GitLabPlatform();
      const result = await gl.createPR('/repo', {
        title: 'Test MR',
        body: 'Description',
        baseBranch: 'main',
        headBranch: 'feat/test',
      });

      expect(result.url).toBe('https://gitlab.com/user/repo/-/merge_requests/7');
      expect(result.number).toBe('7');
      expect(result.title).toBe('Test MR');
    });

    it('adds --draft flag when draft is true', async () => {
      mockExecFile.mockResolvedValue({
        stdout: 'https://gitlab.com/user/repo/-/merge_requests/1',
        stderr: '',
      });

      const { GitLabPlatform } = await import('./GitLabPlatform');
      const gl = new GitLabPlatform();
      await gl.createPR('/repo', {
        title: 'Draft MR',
        body: 'WIP',
        baseBranch: 'main',
        headBranch: 'feat/wip',
        draft: true,
      });

      expect(mockExecFile).toHaveBeenCalledWith(
        'glab',
        expect.arrayContaining(['--draft']),
        expect.any(Object),
      );
    });

    it('includes required args: --title, --source-branch, --target-branch', async () => {
      mockExecFile.mockResolvedValue({
        stdout: 'https://gitlab.com/user/repo/-/merge_requests/3',
        stderr: '',
      });

      const { GitLabPlatform } = await import('./GitLabPlatform');
      const gl = new GitLabPlatform();
      await gl.createPR('/repo', {
        title: 'My MR',
        body: 'Desc',
        baseBranch: 'develop',
        headBranch: 'feat/new',
      });

      expect(mockExecFile).toHaveBeenCalledWith(
        'glab',
        expect.arrayContaining([
          'mr', 'create',
          '--title', 'My MR',
          '--source-branch', 'feat/new',
          '--target-branch', 'develop',
          '--no-editor',
        ]),
        expect.any(Object),
      );
    });
  });

  describe('getPR', () => {
    it('parses MR details from JSON', async () => {
      mockExecFile.mockResolvedValue({
        stdout: JSON.stringify({
          iid: 42,
          title: 'My MR',
          description: 'Description',
          state: 'opened',
          web_url: 'https://gitlab.com/user/repo/-/merge_requests/42',
          author: { username: 'testuser' },
          target_branch: 'main',
          source_branch: 'feat/test',
          merge_status: 'can_be_merged',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        }),
        stderr: '',
      });

      const { GitLabPlatform } = await import('./GitLabPlatform');
      const gl = new GitLabPlatform();
      const pr = await gl.getPR('/repo', '42');

      expect(pr.number).toBe('42');
      expect(pr.title).toBe('My MR');
      expect(pr.body).toBe('Description');
      expect(pr.author).toBe('testuser');
      expect(pr.mergeable).toBe(true);
      expect(pr.baseBranch).toBe('main');
      expect(pr.headBranch).toBe('feat/test');
    });

    it('handles non-mergeable MR', async () => {
      mockExecFile.mockResolvedValue({
        stdout: JSON.stringify({
          iid: 1,
          title: 'Conflict MR',
          description: '',
          state: 'opened',
          web_url: '',
          author: { username: 'user' },
          target_branch: 'main',
          source_branch: 'feat',
          merge_status: 'cannot_be_merged',
          created_at: '',
          updated_at: '',
        }),
        stderr: '',
      });

      const { GitLabPlatform } = await import('./GitLabPlatform');
      const gl = new GitLabPlatform();
      const pr = await gl.getPR('/repo', '1');
      expect(pr.mergeable).toBe(false);
    });

    it('falls back to id when iid is not present', async () => {
      mockExecFile.mockResolvedValue({
        stdout: JSON.stringify({
          id: 99,
          title: 'Fallback',
          description: '',
          state: 'opened',
          web_url: '',
          author: { username: 'user' },
          target_branch: 'main',
          source_branch: 'feat',
          merge_status: 'can_be_merged',
          created_at: '',
          updated_at: '',
        }),
        stderr: '',
      });

      const { GitLabPlatform } = await import('./GitLabPlatform');
      const gl = new GitLabPlatform();
      const pr = await gl.getPR('/repo', '99');
      expect(pr.number).toBe('99');
    });
  });

  describe('mergePR', () => {
    it('uses --squash for squash strategy', async () => {
      mockExecFile.mockResolvedValue({ stdout: '', stderr: '' });

      const { GitLabPlatform } = await import('./GitLabPlatform');
      const gl = new GitLabPlatform();
      await gl.mergePR('/repo', '42', 'squash');

      expect(mockExecFile).toHaveBeenCalledWith(
        'glab',
        expect.arrayContaining(['--squash']),
        expect.any(Object),
      );
    });

    it('uses --rebase for rebase strategy', async () => {
      mockExecFile.mockResolvedValue({ stdout: '', stderr: '' });

      const { GitLabPlatform } = await import('./GitLabPlatform');
      const gl = new GitLabPlatform();
      await gl.mergePR('/repo', '42', 'rebase');

      expect(mockExecFile).toHaveBeenCalledWith(
        'glab',
        expect.arrayContaining(['--rebase']),
        expect.any(Object),
      );
    });

    it('uses plain merge for merge strategy', async () => {
      mockExecFile.mockResolvedValue({ stdout: '', stderr: '' });

      const { GitLabPlatform } = await import('./GitLabPlatform');
      const gl = new GitLabPlatform();
      await gl.mergePR('/repo', '42', 'merge');

      expect(mockExecFile).toHaveBeenCalledWith(
        'glab',
        expect.not.arrayContaining(['--squash', '--rebase']),
        expect.any(Object),
      );
    });

    it('includes --yes flag', async () => {
      mockExecFile.mockResolvedValue({ stdout: '', stderr: '' });

      const { GitLabPlatform } = await import('./GitLabPlatform');
      const gl = new GitLabPlatform();
      await gl.mergePR('/repo', '42', 'merge');

      expect(mockExecFile).toHaveBeenCalledWith(
        'glab',
        expect.arrayContaining(['--yes']),
        expect.any(Object),
      );
    });
  });

  describe('getChecks', () => {
    it('maps pipeline statuses correctly', async () => {
      mockExecFile.mockResolvedValue({
        stdout: JSON.stringify([
          { id: 100, status: 'success', web_url: 'https://gitlab.com/pipelines/100', started_at: null, finished_at: null },
          { id: 101, status: 'running', web_url: null, started_at: null, finished_at: null },
          { id: 102, status: 'failed', web_url: null, started_at: null, finished_at: null },
          { id: 103, status: 'pending', web_url: null, started_at: null, finished_at: null },
          { id: 104, status: 'canceled', web_url: null, started_at: null, finished_at: null },
          { id: 105, status: 'skipped', web_url: null, started_at: null, finished_at: null },
        ]),
        stderr: '',
      });

      const { GitLabPlatform } = await import('./GitLabPlatform');
      const gl = new GitLabPlatform();
      const checks = await gl.getChecks('/repo', 'HEAD');

      expect(checks).toHaveLength(6);
      // success -> completed / success
      expect(checks[0].status).toBe('completed');
      expect(checks[0].conclusion).toBe('success');
      expect(checks[0].name).toBe('Pipeline #100');
      // running -> in_progress / null
      expect(checks[1].status).toBe('in_progress');
      expect(checks[1].conclusion).toBeNull();
      // failed -> completed / failure
      expect(checks[2].status).toBe('completed');
      expect(checks[2].conclusion).toBe('failure');
      // pending -> queued / null
      expect(checks[3].status).toBe('queued');
      expect(checks[3].conclusion).toBeNull();
      // canceled -> completed / cancelled
      expect(checks[4].status).toBe('completed');
      expect(checks[4].conclusion).toBe('cancelled');
      // skipped -> completed / skipped
      expect(checks[5].status).toBe('completed');
      expect(checks[5].conclusion).toBe('skipped');
    });

    it('returns empty array on error', async () => {
      mockExecFile.mockRejectedValue(new Error('no pipelines'));

      const { GitLabPlatform } = await import('./GitLabPlatform');
      const gl = new GitLabPlatform();
      const checks = await gl.getChecks('/repo', 'HEAD');
      expect(checks).toEqual([]);
    });
  });

  describe('searchIssues', () => {
    it('parses issue list', async () => {
      mockExecFile.mockResolvedValue({
        stdout: JSON.stringify([
          {
            iid: 5,
            title: 'Bug report',
            description: 'Something broke',
            state: 'opened',
            web_url: 'https://gitlab.com/user/repo/-/issues/5',
            labels: ['bug', 'critical'],
          },
        ]),
        stderr: '',
      });

      const { GitLabPlatform } = await import('./GitLabPlatform');
      const gl = new GitLabPlatform();
      const issues = await gl.searchIssues('/repo', 'bug');

      expect(issues).toHaveLength(1);
      expect(issues[0].id).toBe('5');
      expect(issues[0].title).toBe('Bug report');
      expect(issues[0].body).toBe('Something broke');
      expect(issues[0].labels).toEqual(['bug', 'critical']);
    });
  });

  describe('listComments', () => {
    it('parses MR notes', async () => {
      mockExecFile.mockResolvedValue({
        stdout: JSON.stringify([
          { id: 101, body: 'Looks good!', author: { username: 'reviewer' }, created_at: '2024-01-01T00:00:00Z' },
          { id: 102, body: 'One small fix needed', author: { username: 'maintainer' }, created_at: '2024-01-02T00:00:00Z' },
        ]),
        stderr: '',
      });

      const { GitLabPlatform } = await import('./GitLabPlatform');
      const gl = new GitLabPlatform();
      const comments = await gl.listComments('/repo', '42');

      expect(comments).toHaveLength(2);
      expect(comments[0].body).toBe('Looks good!');
      expect(comments[0].author).toBe('reviewer');
      expect(comments[1].body).toBe('One small fix needed');
      expect(comments[1].author).toBe('maintainer');
    });

    it('returns empty array on parse error', async () => {
      mockExecFile.mockResolvedValue({
        stdout: 'not json',
        stderr: '',
      });

      const { GitLabPlatform } = await import('./GitLabPlatform');
      const gl = new GitLabPlatform();
      const comments = await gl.listComments('/repo', '42');
      expect(comments).toEqual([]);
    });
  });
});
