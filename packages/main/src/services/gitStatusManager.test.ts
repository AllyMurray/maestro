import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fixtures from '../__test-utils__/fixtures/git-status';

const mockExecFile = vi.fn();
vi.mock('child_process', () => ({
  execFile: (...args: any[]) => mockExecFile(...args),
  promisify: vi.fn((fn: any) => (...fnArgs: any[]) => mockExecFile(...fnArgs)),
}));
vi.mock('util', () => ({
  promisify: vi.fn(() => mockExecFile),
}));

vi.mock('./logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('gitStatusManager', () => {
  beforeEach(() => {
    mockExecFile.mockReset();
    vi.resetModules();
  });

  function setupGitMock(responses: Record<string, string>) {
    mockExecFile.mockImplementation((...args: any[]) => {
      const gitArgs = args[1] as string[];
      const key = gitArgs.join(' ');
      for (const [pattern, value] of Object.entries(responses)) {
        if (key.includes(pattern)) {
          return Promise.resolve({ stdout: value, stderr: '' });
        }
      }
      return Promise.reject(new Error(`Unexpected git call: ${key}`));
    });
  }

  it('parses clean status', async () => {
    setupGitMock({
      'rev-parse --abbrev-ref HEAD': 'main',
      'rev-list --left-right --count': '0\t0',
      'status --porcelain=v1': fixtures.CLEAN,
    });

    const { getGitStatus } = await import('./gitStatusManager');
    const status = await getGitStatus('/test');
    expect(status.branch).toBe('main');
    expect(status.ahead).toBe(0);
    expect(status.behind).toBe(0);
    expect(status.files).toHaveLength(0);
    expect(status.hasConflicts).toBe(false);
  });

  it('parses mixed file statuses', async () => {
    setupGitMock({
      'rev-parse --abbrev-ref HEAD': 'feature',
      'rev-list --left-right --count': '3\t1',
      'status --porcelain=v1': fixtures.MIXED_STATUS,
    });

    const { getGitStatus } = await import('./gitStatusManager');
    const status = await getGitStatus('/test');
    expect(status.branch).toBe('feature');
    expect(status.ahead).toBe(3);
    expect(status.behind).toBe(1);
    expect(status.files).toHaveLength(5);

    const staged = status.files.filter((f) => f.staged);
    expect(staged.length).toBeGreaterThan(0);

    const untracked = status.files.find((f) => f.status === 'untracked');
    expect(untracked).toBeDefined();
    expect(untracked!.path).toBe('src/untracked.ts');
  });

  it('detects conflicts', async () => {
    setupGitMock({
      'rev-parse --abbrev-ref HEAD': 'merge-branch',
      'rev-list --left-right --count': '0\t0',
      'status --porcelain=v1': fixtures.WITH_CONFLICTS,
    });

    const { getGitStatus } = await import('./gitStatusManager');
    const status = await getGitStatus('/test');
    expect(status.hasConflicts).toBe(true);
  });

  it('handles no upstream gracefully', async () => {
    mockExecFile.mockImplementation((...args: any[]) => {
      const gitArgs = args[1] as string[];
      const key = gitArgs.join(' ');
      if (key.includes('rev-parse --abbrev-ref')) {
        return Promise.resolve({ stdout: 'new-branch', stderr: '' });
      }
      if (key.includes('rev-list')) {
        return Promise.reject(new Error('no upstream'));
      }
      if (key.includes('status --porcelain')) {
        return Promise.resolve({ stdout: '', stderr: '' });
      }
      return Promise.reject(new Error(`Unexpected: ${key}`));
    });

    const { getGitStatus } = await import('./gitStatusManager');
    const status = await getGitStatus('/test');
    expect(status.ahead).toBe(0);
    expect(status.behind).toBe(0);
  });

  it('returns fallback status on complete failure', async () => {
    mockExecFile.mockRejectedValue(new Error('git not found'));

    const { getGitStatus } = await import('./gitStatusManager');
    const status = await getGitStatus('/test');
    expect(status.branch).toBe('unknown');
    expect(status.files).toHaveLength(0);
  });

  it('parses untracked files correctly', async () => {
    setupGitMock({
      'rev-parse --abbrev-ref HEAD': 'main',
      'rev-list --left-right --count': '0\t0',
      'status --porcelain=v1': fixtures.UNTRACKED,
    });

    const { getGitStatus } = await import('./gitStatusManager');
    const status = await getGitStatus('/test');
    expect(status.files).toHaveLength(1);
    expect(status.files[0].status).toBe('untracked');
    expect(status.files[0].staged).toBe(false);
  });

  it('parses added files correctly', async () => {
    setupGitMock({
      'rev-parse --abbrev-ref HEAD': 'main',
      'rev-list --left-right --count': '0\t0',
      'status --porcelain=v1': fixtures.ADDED_STAGED,
    });

    const { getGitStatus } = await import('./gitStatusManager');
    const status = await getGitStatus('/test');
    expect(status.files).toHaveLength(1);
    expect(status.files[0].status).toBe('added');
    expect(status.files[0].staged).toBe(true);
  });

  it('parses deleted files correctly', async () => {
    setupGitMock({
      'rev-parse --abbrev-ref HEAD': 'main',
      'rev-list --left-right --count': '0\t0',
      'status --porcelain=v1': fixtures.DELETED_STAGED,
    });

    const { getGitStatus } = await import('./gitStatusManager');
    const status = await getGitStatus('/test');
    expect(status.files).toHaveLength(1);
    expect(status.files[0].status).toBe('deleted');
    expect(status.files[0].staged).toBe(true);
  });
});
