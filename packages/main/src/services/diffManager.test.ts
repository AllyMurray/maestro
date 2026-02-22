import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fixtures from '../__test-utils__/fixtures/git-diff';

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

describe('diffManager', () => {
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

  it('parses single file numstat', async () => {
    setupGitMock({
      '--numstat': fixtures.SINGLE_FILE,
      '--diff-filter': '',
    });

    const { getDiffFiles } = await import('./diffManager');
    const files = await getDiffFiles('/test');
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe('src/index.ts');
    expect(files[0].additions).toBe(10);
    expect(files[0].deletions).toBe(5);
  });

  it('parses multiple files', async () => {
    setupGitMock({
      '--numstat': fixtures.MULTIPLE_FILES,
      '--diff-filter': '',
    });

    const { getDiffFiles } = await import('./diffManager');
    const files = await getDiffFiles('/test');
    expect(files).toHaveLength(3);
  });

  it('handles binary files with dash stats', async () => {
    setupGitMock({
      '--numstat': fixtures.BINARY_FILE,
      '--diff-filter': '',
    });

    const { getDiffFiles } = await import('./diffManager');
    const files = await getDiffFiles('/test');
    expect(files).toHaveLength(1);
    expect(files[0].additions).toBe(0);
    expect(files[0].deletions).toBe(0);
  });

  it('returns empty array for no changes', async () => {
    setupGitMock({
      '--numstat': fixtures.EMPTY,
    });

    const { getDiffFiles } = await import('./diffManager');
    const files = await getDiffFiles('/test');
    expect(files).toHaveLength(0);
  });

  it('passes base branch to git diff', async () => {
    setupGitMock({
      '--numstat': fixtures.SINGLE_FILE,
      '--diff-filter': '',
    });

    const { getDiffFiles } = await import('./diffManager');
    await getDiffFiles('/test', 'main');
    expect(mockExecFile).toHaveBeenCalledWith(
      'git',
      expect.arrayContaining(['diff', '--numstat', 'main']),
      expect.any(Object),
    );
  });

  it('getFileDiff returns diff for a specific file', async () => {
    const diffContent = `--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1,3 +1,4 @@\n+import foo\n`;
    setupGitMock({
      'diff': diffContent,
    });

    const { getFileDiff } = await import('./diffManager');
    const diff = await getFileDiff('/test', 'src/index.ts');
    expect(diff).toContain('+import foo');
  });

  it('getFileContent returns file at ref', async () => {
    setupGitMock({
      'show HEAD:src/index.ts': 'file content here',
    });

    const { getFileContent } = await import('./diffManager');
    const content = await getFileContent('/test', 'src/index.ts');
    expect(content).toBe('file content here');
  });

  it('getFileContent returns empty string on failure', async () => {
    mockExecFile.mockRejectedValue(new Error('not found'));

    const { getFileContent } = await import('./diffManager');
    const content = await getFileContent('/test', 'nonexistent.ts');
    expect(content).toBe('');
  });
});
