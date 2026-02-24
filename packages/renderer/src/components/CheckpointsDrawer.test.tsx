import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../__test-utils__/render';
import { CheckpointsDrawer } from './CheckpointsDrawer';

describe('CheckpointsDrawer', () => {
  it('shows unavailable message when workspacePath is missing', () => {
    renderWithProviders(
      <CheckpointsDrawer opened onClose={() => {}} workspaceId="ws1" workspacePath={null} />,
    );

    expect(
      screen.getByText('Checkpoints are unavailable until the workspace worktree is ready.'),
    ).toBeInTheDocument();
  });
});
