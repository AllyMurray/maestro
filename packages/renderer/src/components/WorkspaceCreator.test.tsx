import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '../__test-utils__/render';
import { WorkspaceCreator } from './WorkspaceCreator';

describe('WorkspaceCreator', () => {
  const defaultProps = {
    opened: true,
    onClose: vi.fn(),
    onSubmit: vi.fn(),
    projectName: 'Test Project',
    defaultBranch: 'main',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    renderWithProviders(<WorkspaceCreator {...defaultProps} opened={false} />);
    expect(screen.queryByText('New Workspace')).not.toBeInTheDocument();
  });

  it('renders the form when opened', () => {
    renderWithProviders(<WorkspaceCreator {...defaultProps} />);
    expect(screen.getByText('New Workspace')).toBeInTheDocument();
    expect(screen.getByLabelText(/Workspace name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Branch name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Target branch/)).toBeInTheDocument();
  });

  it('auto-generates branch name from workspace name', async () => {
    renderWithProviders(<WorkspaceCreator {...defaultProps} />);

    const nameInput = screen.getByLabelText(/Workspace name/);
    await userEvent.type(nameInput, 'Add User Auth');

    const branchInput = screen.getByLabelText(/Branch name/) as HTMLInputElement;
    expect(branchInput.value).toBe('add-user-auth');
  });

  it('Create button is disabled when fields are empty', () => {
    renderWithProviders(<WorkspaceCreator {...defaultProps} />);
    // Mantine renders the text inside a span, but the disabled attr is on the parent button
    const createBtn = screen.getByText('Create Workspace').closest('button');
    expect(createBtn).toBeDisabled();
  });

  it('shows Cancel and Create buttons', () => {
    renderWithProviders(<WorkspaceCreator {...defaultProps} />);
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Create Workspace')).toBeInTheDocument();
  });

  it('calls onClose when Cancel is clicked', async () => {
    const onClose = vi.fn();
    renderWithProviders(<WorkspaceCreator {...defaultProps} onClose={onClose} />);

    await userEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('pre-fills target branch with defaultBranch prop', () => {
    renderWithProviders(<WorkspaceCreator {...defaultProps} defaultBranch="develop" />);
    const targetInput = screen.getByLabelText(/Target branch/) as HTMLInputElement;
    expect(targetInput.value).toBe('develop');
  });

  it('preselects the only available AI agent', async () => {
    (window.maestro.invoke as any).mockResolvedValueOnce([
      { type: 'claude-code', displayName: 'Claude Code', available: true },
      { type: 'codex', displayName: 'Codex', available: false, reason: 'not installed' },
      { type: 'cursor', displayName: 'Cursor', available: false, reason: 'not installed' },
    ]);

    renderWithProviders(<WorkspaceCreator {...defaultProps} />);

    await waitFor(() => {
      expect((screen.getByRole('textbox', { name: 'AI Agent' }) as HTMLInputElement).value).toBe(
        'Claude Code',
      );
    });
  });

  it('does not preselect an AI agent when multiple are available', async () => {
    (window.maestro.invoke as any).mockResolvedValueOnce([
      { type: 'claude-code', displayName: 'Claude Code', available: true },
      { type: 'codex', displayName: 'Codex', available: true },
      { type: 'cursor', displayName: 'Cursor', available: false, reason: 'not installed' },
    ]);

    renderWithProviders(<WorkspaceCreator {...defaultProps} />);

    await waitFor(() => {
      expect((screen.getByRole('textbox', { name: 'AI Agent' }) as HTMLInputElement).value).toBe(
        '',
      );
    });
  });
});
