import { describe, it, expect, vi } from 'vitest';
import type React from 'react';
import { renderWithProviders, screen, userEvent } from '../__test-utils__/render';
import { WorkspaceHeaderMenu } from './WorkspaceHeaderMenu';

function renderMenu(overrides: Partial<React.ComponentProps<typeof WorkspaceHeaderMenu>> = {}) {
  const props: React.ComponentProps<typeof WorkspaceHeaderMenu> = {
    onOpenCheckpoints: vi.fn(),
    onOpenTodos: vi.fn(),
    onOpenPR: vi.fn(),
    onLinkIssue: vi.fn(),
    onChangeStatus: vi.fn(),
    onDelete: vi.fn(),
    hasPR: false,
    hasGitPlatform: true,
    ...overrides,
  };

  renderWithProviders(<WorkspaceHeaderMenu {...props} />);
  return props;
}

describe('WorkspaceHeaderMenu', () => {
  it('shows core actions and triggers callbacks', async () => {
    const props = renderMenu();

    await userEvent.click(screen.getByRole('button', { name: 'Workspace actions' }));
    await userEvent.click(await screen.findByText('Checkpoints'));
    await userEvent.click(screen.getByRole('button', { name: 'Workspace actions' }));
    await userEvent.click(await screen.findByText('Todos'));

    expect(props.onOpenCheckpoints).toHaveBeenCalledTimes(1);
    expect(props.onOpenTodos).toHaveBeenCalledTimes(1);
  });

  it('hides PR and issue actions when no git platform', async () => {
    renderMenu({ hasGitPlatform: false });

    await userEvent.click(screen.getByRole('button', { name: 'Workspace actions' }));

    expect(screen.queryByText('Create PR')).not.toBeInTheDocument();
    expect(screen.queryByText('Link Issue')).not.toBeInTheDocument();
    expect(await screen.findByText('Change Status')).toBeInTheDocument();
  });
});
