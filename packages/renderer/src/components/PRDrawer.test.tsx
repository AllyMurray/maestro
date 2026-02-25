import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '../__test-utils__/render';
import { PRDrawer } from './PRDrawer';

vi.mock('./PRView', () => ({
  PRView: ({ prId }: { prId: string }) => <div>PR View {prId}</div>,
}));

vi.mock('./PRCreator', () => ({
  PRCreator: ({
    opened,
    onCreated,
  }: {
    opened: boolean;
    onCreated?: (r: { number: string; url: string }) => void;
  }) =>
    opened ? (
      <button onClick={() => onCreated?.({ number: '123', url: 'https://example/pr/123' })}>
        Mock Create
      </button>
    ) : null,
}));

const baseWorkspace = {
  id: 'w1',
  projectId: 'p1',
  name: 'WS',
  branchName: 'feat/a',
  worktreePath: '/tmp/ws',
  agentType: 'claude-code',
  status: 'in_progress',
  prNumber: null,
  prUrl: null,
  targetBranch: 'main',
  createdAt: '',
} as any;

const baseProject = {
  id: 'p1',
  name: 'Proj',
  path: '/tmp/repo',
  gitPlatform: 'github',
  defaultBranch: 'main',
  settingsJson: '{}',
  createdAt: '',
} as any;

describe('PRDrawer', () => {
  it('renders PR view when workspace already has PR', () => {
    renderWithProviders(
      <PRDrawer
        opened
        onClose={() => {}}
        workspace={{ ...baseWorkspace, prNumber: '99', prUrl: 'https://example/pr/99' }}
        project={baseProject}
        onPRCreated={() => {}}
      />,
    );

    expect(screen.getByText('PR View 99')).toBeInTheDocument();
  });

  it('opens creator and forwards created result', async () => {
    const onPRCreated = vi.fn();
    const onClose = vi.fn();

    renderWithProviders(
      <PRDrawer
        opened
        onClose={onClose}
        workspace={baseWorkspace}
        project={baseProject}
        onPRCreated={onPRCreated}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Create Pull Request' }));
    await userEvent.click(screen.getByRole('button', { name: 'Mock Create' }));

    expect(onPRCreated).toHaveBeenCalledWith({ number: '123', url: 'https://example/pr/123' });
    expect(onClose).toHaveBeenCalled();
  });
});
