import { execFile } from 'child_process';
import { promisify } from 'util';
import { BaseGitPlatform } from './BaseGitPlatform';
import { logger } from '../logger';
import type {
  CreatePROptions,
  PRResult,
  PRDetails,
  PRComment,
  CICheck,
  Issue,
  MergeStrategy,
} from '@maestro/shared';

const execFileAsync = promisify(execFile);

async function gh(repoPath: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('gh', args, { cwd: repoPath, timeout: 30000 });
  return stdout.trim();
}

export class GitHubPlatform extends BaseGitPlatform {
  readonly platform = 'github' as const;

  async detect(repoPath: string): Promise<boolean> {
    try {
      const url = await execFileAsync('git', ['remote', 'get-url', 'origin'], { cwd: repoPath });
      return url.stdout.includes('github.com');
    } catch {
      return false;
    }
  }

  async createPR(repoPath: string, opts: CreatePROptions): Promise<PRResult> {
    const args = [
      'pr', 'create',
      '--title', opts.title,
      '--body', opts.body,
      '--base', opts.baseBranch,
      '--head', opts.headBranch,
    ];

    if (opts.draft) {
      args.push('--draft');
    }

    const output = await gh(repoPath, ...args);
    // gh pr create outputs the PR URL
    const url = output.trim();
    const number = url.split('/').pop() || '';

    logger.info(`GitHub PR created: ${url}`);
    return { number, url, title: opts.title };
  }

  async getPR(repoPath: string, id: string): Promise<PRDetails> {
    const output = await gh(
      repoPath,
      'pr', 'view', id,
      '--json', 'number,title,body,state,url,author,baseRefName,headRefName,mergeable,createdAt,updatedAt',
    );
    const data = JSON.parse(output);

    return {
      number: String(data.number),
      title: data.title,
      body: data.body,
      state: data.state,
      url: data.url,
      author: data.author?.login || '',
      baseBranch: data.baseRefName,
      headBranch: data.headRefName,
      mergeable: data.mergeable === 'MERGEABLE',
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  async listComments(repoPath: string, prId: string): Promise<PRComment[]> {
    const output = await gh(
      repoPath,
      'pr', 'view', prId,
      '--json', 'comments',
    );
    const data = JSON.parse(output);

    return (data.comments || []).map((c: Record<string, unknown>) => ({
      id: String(c.id || ''),
      body: String(c.body || ''),
      author: (c.author as Record<string, string>)?.login || '',
      createdAt: String(c.createdAt || ''),
    }));
  }

  async mergePR(repoPath: string, prId: string, strategy: MergeStrategy): Promise<void> {
    const args = ['pr', 'merge', prId];

    switch (strategy) {
      case 'squash':
        args.push('--squash');
        break;
      case 'rebase':
        args.push('--rebase');
        break;
      default:
        args.push('--merge');
        break;
    }

    args.push('--delete-branch');

    await gh(repoPath, ...args);
    logger.info(`GitHub PR ${prId} merged with ${strategy} strategy`);
  }

  async getChecks(repoPath: string, ref: string): Promise<CICheck[]> {
    try {
      const output = await gh(
        repoPath,
        'pr', 'checks', ref,
        '--json', 'name,state,conclusion,detailsUrl,startedAt,completedAt',
      );
      const checks = JSON.parse(output);

      return checks.map((c: Record<string, unknown>) => ({
        name: String(c.name || ''),
        status: mapGitHubStatus(String(c.state || '')),
        conclusion: mapGitHubConclusion(c.conclusion as string | null),
        url: c.detailsUrl as string | null,
        startedAt: c.startedAt as string | null,
        completedAt: c.completedAt as string | null,
      }));
    } catch {
      return [];
    }
  }

  async searchIssues(repoPath: string, query: string): Promise<Issue[]> {
    const output = await gh(
      repoPath,
      'issue', 'list',
      '--search', query,
      '--json', 'number,title,body,state,url,labels',
      '--limit', '20',
    );
    const issues = JSON.parse(output);

    return issues.map((i: Record<string, unknown>) => ({
      id: String(i.number),
      number: String(i.number),
      title: String(i.title || ''),
      body: String(i.body || ''),
      state: String(i.state || ''),
      url: String(i.url || ''),
      labels: ((i.labels as Array<Record<string, string>>) || []).map((l) => l.name),
    }));
  }
}

function mapGitHubStatus(state: string): CICheck['status'] {
  switch (state.toUpperCase()) {
    case 'COMPLETED':
      return 'completed';
    case 'IN_PROGRESS':
    case 'PENDING':
      return 'in_progress';
    default:
      return 'queued';
  }
}

function mapGitHubConclusion(conclusion: string | null): CICheck['conclusion'] {
  if (!conclusion) return null;
  switch (conclusion.toUpperCase()) {
    case 'SUCCESS':
      return 'success';
    case 'FAILURE':
      return 'failure';
    case 'NEUTRAL':
      return 'neutral';
    case 'CANCELLED':
      return 'cancelled';
    case 'SKIPPED':
      return 'skipped';
    case 'TIMED_OUT':
      return 'timed_out';
    default:
      return null;
  }
}
