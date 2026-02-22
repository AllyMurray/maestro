import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from './appStore';

describe('appStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    useAppStore.setState({
      activeProjectId: null,
      activeWorkspaceId: null,
      activeSessionId: null,
      projects: [],
      workspaces: [],
    });
  });

  describe('setActiveProject', () => {
    it('sets active project and clears workspace', () => {
      useAppStore.getState().setActiveWorkspace('ws1');
      useAppStore.getState().setActiveProject('p1');

      const state = useAppStore.getState();
      expect(state.activeProjectId).toBe('p1');
      expect(state.activeWorkspaceId).toBeNull();
    });

    it('sets to null', () => {
      useAppStore.getState().setActiveProject('p1');
      useAppStore.getState().setActiveProject(null);

      expect(useAppStore.getState().activeProjectId).toBeNull();
    });
  });

  describe('setActiveWorkspace', () => {
    it('sets active workspace', () => {
      useAppStore.getState().setActiveWorkspace('ws1');
      expect(useAppStore.getState().activeWorkspaceId).toBe('ws1');
    });
  });

  describe('setActiveSession', () => {
    it('sets active session', () => {
      useAppStore.getState().setActiveSession('s1');
      expect(useAppStore.getState().activeSessionId).toBe('s1');
    });
  });

  describe('setProjects', () => {
    it('replaces all projects', () => {
      const projects = [
        { id: 'p1', name: 'P1', path: '/p1', gitPlatform: null, defaultBranch: 'main', settingsJson: '{}', createdAt: '' },
        { id: 'p2', name: 'P2', path: '/p2', gitPlatform: null, defaultBranch: 'main', settingsJson: '{}', createdAt: '' },
      ];
      useAppStore.getState().setProjects(projects as any);
      expect(useAppStore.getState().projects).toHaveLength(2);
    });
  });

  describe('addProject', () => {
    it('adds project to the beginning', () => {
      const p1 = { id: 'p1', name: 'P1', path: '/p1', gitPlatform: null, defaultBranch: 'main', settingsJson: '{}', createdAt: '' };
      const p2 = { id: 'p2', name: 'P2', path: '/p2', gitPlatform: null, defaultBranch: 'main', settingsJson: '{}', createdAt: '' };

      useAppStore.getState().addProject(p1 as any);
      useAppStore.getState().addProject(p2 as any);

      const projects = useAppStore.getState().projects;
      expect(projects).toHaveLength(2);
      expect(projects[0].id).toBe('p2'); // Most recent first
    });
  });

  describe('removeProject', () => {
    it('removes a project', () => {
      const projects = [
        { id: 'p1', name: 'P1', path: '/p1', gitPlatform: null, defaultBranch: 'main', settingsJson: '{}', createdAt: '' },
        { id: 'p2', name: 'P2', path: '/p2', gitPlatform: null, defaultBranch: 'main', settingsJson: '{}', createdAt: '' },
      ];
      useAppStore.getState().setProjects(projects as any);
      useAppStore.getState().removeProject('p1');

      expect(useAppStore.getState().projects).toHaveLength(1);
      expect(useAppStore.getState().projects[0].id).toBe('p2');
    });

    it('clears activeProjectId if removing the active project', () => {
      const p1 = { id: 'p1', name: 'P1', path: '/p1', gitPlatform: null, defaultBranch: 'main', settingsJson: '{}', createdAt: '' };
      useAppStore.getState().setProjects([p1 as any]);
      useAppStore.getState().setActiveProject('p1');
      useAppStore.getState().removeProject('p1');

      expect(useAppStore.getState().activeProjectId).toBeNull();
    });

    it('does not clear activeProjectId if removing a different project', () => {
      const projects = [
        { id: 'p1', name: 'P1', path: '/p1', gitPlatform: null, defaultBranch: 'main', settingsJson: '{}', createdAt: '' },
        { id: 'p2', name: 'P2', path: '/p2', gitPlatform: null, defaultBranch: 'main', settingsJson: '{}', createdAt: '' },
      ];
      useAppStore.getState().setProjects(projects as any);
      useAppStore.getState().setActiveProject('p1');
      useAppStore.getState().removeProject('p2');

      expect(useAppStore.getState().activeProjectId).toBe('p1');
    });
  });

  describe('addWorkspace', () => {
    it('adds workspace to the beginning', () => {
      const ws = { id: 'ws1', projectId: 'p1', name: 'WS', branchName: 'main', worktreePath: null, status: 'active' as const, prNumber: null, prUrl: null, targetBranch: 'main', createdAt: '' };
      useAppStore.getState().addWorkspace(ws as any);

      expect(useAppStore.getState().workspaces).toHaveLength(1);
    });
  });

  describe('removeWorkspace', () => {
    it('removes workspace and clears active if matching', () => {
      const ws = { id: 'ws1', projectId: 'p1', name: 'WS', branchName: 'main', worktreePath: null, status: 'active' as const, prNumber: null, prUrl: null, targetBranch: 'main', createdAt: '' };
      useAppStore.getState().setWorkspaces([ws as any]);
      useAppStore.getState().setActiveWorkspace('ws1');
      useAppStore.getState().removeWorkspace('ws1');

      expect(useAppStore.getState().workspaces).toHaveLength(0);
      expect(useAppStore.getState().activeWorkspaceId).toBeNull();
    });
  });
});
