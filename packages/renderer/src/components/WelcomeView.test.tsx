import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '../__test-utils__/render';
import { WelcomeView } from './WelcomeView';

describe('WelcomeView', () => {
  it('renders core content and opens repository action', async () => {
    const onAddProject = vi.fn();
    renderWithProviders(<WelcomeView onAddProject={onAddProject} />);

    expect(screen.getByRole('heading', { name: 'Maestro' })).toBeInTheDocument();
    expect(screen.getByText('Isolated Worktrees')).toBeInTheDocument();
    expect(screen.getByText('Multiple Agents')).toBeInTheDocument();
    expect(screen.getByText('Full PR Lifecycle')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Open Repository' }));
    expect(onAddProject).toHaveBeenCalledTimes(1);
  });
});
