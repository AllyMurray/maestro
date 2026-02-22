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

async function glab(repoPath: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('glab', args, { cwd: repoPath, timeout: 30000 });
  return stdout.trim();
}

export class GitLabPlatform extends BaseGitPlatform {
  readonly platform = 'gitlab' as const;

  async detect(repoPath: string): Promise<boolean> {
    try {
      const url = await execFileAsync('git', ['remote', 'get-url', 'origin'], { cwd: repoPath });
      return url.stdout.includes('gitlab');
    } catch {
      return false;
    }
  }

  async createPR(repoPath: string, opts: CreatePROptions): Promise<PRResult> {
    const args = [
      'mr', 'create',
      '--title', opts.title,
      '--description', opts.body,
      '--source-branch', opts.headBranch,
      '--target-branch', opts.baseBranch,
      '--no-editor',
    ];

    if (opts.draft) {
      args.push('--draft');
    }

    const output = await glab(repoPath, ...args);
    // Parse MR URL from output
    const urlMatch = output.match(/https?:\/\/\S+/);
    const url = urlMatch ? urlMatch[0] : '';
    const number = url.split('/').pop() || '';

    logger.info(`GitLab MR created: ${url}`);
    return { number, url, title: opts.title };
  }

  async getPR(repoPath: string, id: string): Promise<PRDetails> {
    const output = await glab(repoPath, 'mr', 'view', id, '--output', 'json');
    const data = JSON.parse(output);

    return {
      number: String(data.iid || data.id),
      title: data.title || '',
      body: data.description || '',
      state: data.state || '',
      url: data.web_url || '',
      author: data.author?.username || '',
      baseBranch: data.target_branch || '',
      headBranch: data.source_branch || '',
      mergeable: data.merge_status === 'can_be_merged',
      createdAt: data.created_at || '',
      updatedAt: data.updated_at || '',
    };
  }

  async listComments(repoPath: string, prId: string): Promise<PRComment[]> {
    const output = await glab(repoPath, 'mr', 'note', 'list', prId, '--output', 'json');
    let notes: Array<Record<string, unknown>>;
    try {
      notes = JSON.parse(output);
    } catch {
      return [];
    }

    return notes.map((n) => ({
      id: String(n.id || ''),
      body: String(n.body || ''),
      author: (n.author as Record<string, string>)?.username || '',
      createdAt: String(n.created_at || ''),
    }));
  }

  async mergePR(repoPath: string, prId: string, strategy: MergeStrategy): Promise<void> {
    const args = ['mr', 'merge', prId, '--yes'];

    if (strategy === 'squash') {
      args.push('--squash');
    } else if (strategy === 'rebase') {
      args.push('--rebase');
    }

    await glab(repoPath, ...args);
    logger.info(`GitLab MR ${prId} merged with ${strategy} strategy`);
  }

  async getChecks(repoPath: string, _ref: string): Promise<CICheck[]> {
    try {
      const output = await glab(repoPath, 'ci', 'list', '--output', 'json');
      const pipelines = JSON.parse(output);

      return pipelines.map((p: Record<string, unknown>) => ({
        name: `Pipeline #${p.id}`,
        status: mapGitLabStatus(String(p.status || '')),
        conclusion: mapGitLabConclusion(String(p.status || '')),
        url: p.web_url as string | null,
        startedAt: p.started_at as string | null,
        completedAt: p.finished_at as string | null,
      }));
    } catch {
      return [];
    }
  }

  async searchIssues(repoPath: string, query: string): Promise<Issue[]> {
    const output = await glab(
      repoPath,
      'issue', 'list',
      '--search', query,
      '--output', 'json',
    );
    const issues = JSON.parse(output);

    return issues.map((i: Record<string, unknown>) => ({
      id: String(i.iid || i.id),
      number: String(i.iid || i.id),
      title: String(i.title || ''),
      body: String(i.description || ''),
      state: String(i.state || ''),
      url: String(i.web_url || ''),
      labels: (i.labels as string[]) || [],
    }));
  }
}

function mapGitLabStatus(status: string): CICheck['status'] {
  switch (status) {
    case 'success':
    case 'failed':
    case 'canceled':
    case 'skipped':
      return 'completed';
    case 'running':
      return 'in_progress';
    default:
      return 'queued';
  }
}

function mapGitLabConclusion(status: string): CICheck['conclusion'] {
  switch (status) {
    case 'success':
      return 'success';
    case 'failed':
      return 'failure';
    case 'canceled':
      return 'cancelled';
    case 'skipped':
      return 'skipped';
    default:
      return null;
  }
}
