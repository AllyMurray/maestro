import { describe, it, expect } from 'vitest';
import type { Project } from '@maestro/shared';
import { resolveInitialActiveProjectId } from './App';

describe('resolveInitialActiveProjectId', () => {
  const projects: Project[] = [
    {
      id: 'p1',
      name: 'A',
      path: '/tmp/a',
      gitPlatform: null,
      defaultBranch: 'main',
      settingsJson: '{}',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'p2',
      name: 'B',
      path: '/tmp/b',
      gitPlatform: null,
      defaultBranch: 'main',
      settingsJson: '{}',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  it('returns null when there are no projects', () => {
    expect(resolveInitialActiveProjectId([], null, null)).toBeNull();
  });

  it('keeps current active project when it still exists', () => {
    expect(resolveInitialActiveProjectId(projects, 'p2', 'p1')).toBe('p2');
  });

  it('restores saved active project when current is missing', () => {
    expect(resolveInitialActiveProjectId(projects, null, 'p2')).toBe('p2');
  });

  it('falls back to first project when saved id is stale', () => {
    expect(resolveInitialActiveProjectId(projects, null, 'missing')).toBe('p1');
  });
});
