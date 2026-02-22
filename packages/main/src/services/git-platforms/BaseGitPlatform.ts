import type {
  CreatePROptions,
  PRResult,
  PRDetails,
  PRComment,
  CICheck,
  Issue,
  MergeStrategy,
} from '@maestro/shared';

export abstract class BaseGitPlatform {
  abstract readonly platform: 'github' | 'gitlab';

  abstract detect(repoPath: string): Promise<boolean>;
  abstract createPR(repoPath: string, opts: CreatePROptions): Promise<PRResult>;
  abstract getPR(repoPath: string, id: string): Promise<PRDetails>;
  abstract listComments(repoPath: string, prId: string): Promise<PRComment[]>;
  abstract mergePR(repoPath: string, prId: string, strategy: MergeStrategy): Promise<void>;
  abstract getChecks(repoPath: string, ref: string): Promise<CICheck[]>;
  abstract searchIssues(repoPath: string, query: string): Promise<Issue[]>;
}
