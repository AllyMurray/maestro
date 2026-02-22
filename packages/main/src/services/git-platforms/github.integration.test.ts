import { describe, it, expect, beforeAll } from 'vitest';
import { hasCommand } from '../../__test-utils__/exec';

let hasGh = false;

beforeAll(async () => {
  hasGh = await hasCommand('gh');
});

describe.skipIf(!hasGh)('GitHub Platform Integration', () => {
  it('gh CLI is available', () => {
    expect(hasGh).toBe(true);
  });

  it('GitHubPlatform.detect works with real repo', async () => {
    // Only test if we're in a GitHub repo
    const { execSync } = await import('child_process');
    let isGithub = false;
    try {
      const url = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();
      isGithub = url.includes('github.com');
    } catch {
      // Not in a git repo with a remote
    }

    if (!isGithub) return;

    const { GitHubPlatform } = await import('./GitHubPlatform');
    const gh = new GitHubPlatform();
    const detected = await gh.detect(process.cwd());
    expect(detected).toBe(true);
  });
});
