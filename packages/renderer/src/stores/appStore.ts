import { create } from 'zustand';
import type { Project, Workspace, Session } from '@maestro/shared';

interface AppState {
  // Navigation
  activeProjectId: string | null;
  activeWorkspaceId: string | null;
  activeSessionId: string | null;
  activeWorkspaceTab: string | null;

  // Data
  projects: Project[];
  workspaces: Workspace[];

  // Actions
  setActiveProject: (id: string | null) => void;
  setActiveWorkspace: (id: string | null) => void;
  setActiveSession: (id: string | null) => void;
  setActiveWorkspaceTab: (tab: string | null) => void;
  setProjects: (projects: Project[]) => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
  addProject: (project: Project) => void;
  addWorkspace: (workspace: Workspace) => void;
  removeProject: (id: string) => void;
  removeWorkspace: (id: string) => void;
  updateWorkspace: (id: string, updates: Partial<Workspace>) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeProjectId: null,
  activeWorkspaceId: null,
  activeSessionId: null,
  activeWorkspaceTab: 'chat',
  projects: [],
  workspaces: [],

  setActiveProject: (id) => set({ activeProjectId: id, activeWorkspaceId: null }),
  setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),
  setActiveSession: (id) => set({ activeSessionId: id }),
  setActiveWorkspaceTab: (tab) => set({ activeWorkspaceTab: tab }),
  setProjects: (projects) => set({ projects }),
  setWorkspaces: (workspaces) => set({ workspaces }),
  addProject: (project) => set((s) => ({ projects: [project, ...s.projects] })),
  addWorkspace: (workspace) => set((s) => ({ workspaces: [workspace, ...s.workspaces] })),
  removeProject: (id) =>
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      activeProjectId: s.activeProjectId === id ? null : s.activeProjectId,
    })),
  removeWorkspace: (id) =>
    set((s) => ({
      workspaces: s.workspaces.filter((w) => w.id !== id),
      activeWorkspaceId: s.activeWorkspaceId === id ? null : s.activeWorkspaceId,
    })),
  updateWorkspace: (id, updates) =>
    set((s) => ({
      workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, ...updates } : w)),
    })),
}));
