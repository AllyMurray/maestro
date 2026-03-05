import { describe, it, expect } from 'vitest';
import { resolveInitialActiveProjectId, resolveInitialActiveWorkspaceId } from './App';
import type { Project, Workspace } from '@maestro/shared';

describe('App selection helpers', () => {
  describe('resolveInitialActiveProjectId', () => {
    const projects: Project[] = [
      {
        id: 'p1',
        name: 'Repo One',
        path: '/repo-1',
        gitPlatform: null,
        defaultBranch: 'main',
        settingsJson: '{}',
        createdAt: '',
      },
      {
        id: 'p2',
        name: 'Repo Two',
        path: '/repo-2',
        gitPlatform: null,
        defaultBranch: 'main',
        settingsJson: '{}',
        createdAt: '',
      },
    ];

    it('prefers current active project when still available', () => {
      expect(resolveInitialActiveProjectId(projects, 'p2', 'p1')).toBe('p2');
    });

    it('uses saved active project when current is unavailable', () => {
      expect(resolveInitialActiveProjectId(projects, 'missing', 'p2')).toBe('p2');
    });

    it('falls back to first project when no ids are valid', () => {
      expect(resolveInitialActiveProjectId(projects, null, 'missing')).toBe('p1');
    });
  });

  describe('resolveInitialActiveWorkspaceId', () => {
    const workspaces: Workspace[] = [
      {
        id: 'w1',
        projectId: 'p1',
        name: 'Workspace One',
        branchName: 'feat/one',
        worktreePath: '/wt/1',
        agentType: 'claude-code',
        status: 'in_progress',
        prNumber: null,
        prUrl: null,
        targetBranch: 'main',
        createdAt: '',
      },
      {
        id: 'w2',
        projectId: 'p1',
        name: 'Workspace Two',
        branchName: 'feat/two',
        worktreePath: '/wt/2',
        agentType: 'claude-code',
        status: 'backlog',
        prNumber: null,
        prUrl: null,
        targetBranch: 'main',
        createdAt: '',
      },
    ];

    it('prefers current active workspace when still available', () => {
      expect(resolveInitialActiveWorkspaceId(workspaces, 'w2', 'w1')).toBe('w2');
    });

    it('uses saved active workspace when current is unavailable', () => {
      expect(resolveInitialActiveWorkspaceId(workspaces, 'missing', 'w2')).toBe('w2');
    });

    it('falls back to first workspace when no ids are valid', () => {
      expect(resolveInitialActiveWorkspaceId(workspaces, null, 'missing')).toBe('w1');
    });

    it('returns null when there are no workspaces', () => {
      expect(resolveInitialActiveWorkspaceId([], null, null)).toBeNull();
    });
  });
});
