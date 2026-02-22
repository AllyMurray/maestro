import { BaseGitPlatform } from './BaseGitPlatform';
import { GitHubPlatform } from './GitHubPlatform';
import { GitLabPlatform } from './GitLabPlatform';
import type { GitPlatform } from '@maestro/shared';

const platforms: Record<GitPlatform, () => BaseGitPlatform> = {
  github: () => new GitHubPlatform(),
  gitlab: () => new GitLabPlatform(),
};

export function createGitPlatform(type: GitPlatform): BaseGitPlatform {
  const factory = platforms[type];
  if (!factory) {
    throw new Error(`Unknown git platform: ${type}`);
  }
  return factory();
}

export async function detectGitPlatform(repoPath: string): Promise<BaseGitPlatform | null> {
  const github = new GitHubPlatform();
  if (await github.detect(repoPath)) return github;

  const gitlab = new GitLabPlatform();
  if (await gitlab.detect(repoPath)) return gitlab;

  return null;
}
