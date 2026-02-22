import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '../__test-utils__/render';
import { TodoList } from './TodoList';

describe('TodoList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state', async () => {
    (window.maestro.invoke as any).mockResolvedValue([]);

    renderWithProviders(<TodoList workspaceId="ws1" />);
    await waitFor(() => {
      expect(screen.getByText('No todos yet')).toBeInTheDocument();
    });
  });

  it('renders todo items', async () => {
    (window.maestro.invoke as any).mockResolvedValue([
      { id: 1, workspaceId: 'ws1', title: 'Fix bug', isCompleted: false, blocksMerge: true, createdAt: '' },
      { id: 2, workspaceId: 'ws1', title: 'Add tests', isCompleted: true, blocksMerge: false, createdAt: '' },
    ]);

    renderWithProviders(<TodoList workspaceId="ws1" />);
    await waitFor(() => {
      expect(screen.getByText('Fix bug')).toBeInTheDocument();
      expect(screen.getByText('Add tests')).toBeInTheDocument();
    });
  });

  it('shows completion count', async () => {
    (window.maestro.invoke as any).mockResolvedValue([
      { id: 1, workspaceId: 'ws1', title: 'Task 1', isCompleted: true, blocksMerge: false, createdAt: '' },
      { id: 2, workspaceId: 'ws1', title: 'Task 2', isCompleted: false, blocksMerge: false, createdAt: '' },
    ]);

    renderWithProviders(<TodoList workspaceId="ws1" />);
    await waitFor(() => {
      expect(screen.getByText('1/2')).toBeInTheDocument();
    });
  });

  it('shows blocker badge for blocking todos', async () => {
    (window.maestro.invoke as any).mockResolvedValue([
      { id: 1, workspaceId: 'ws1', title: 'Critical', isCompleted: false, blocksMerge: true, createdAt: '' },
    ]);

    renderWithProviders(<TodoList workspaceId="ws1" />);
    await waitFor(() => {
      expect(screen.getByText('Blocker')).toBeInTheDocument();
      expect(screen.getByText('1 blocking merge')).toBeInTheDocument();
    });
  });

  it('renders the add todo input', async () => {
    (window.maestro.invoke as any).mockResolvedValue([]);

    renderWithProviders(<TodoList workspaceId="ws1" />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Add a todo...')).toBeInTheDocument();
    });
  });

  it('shows Todos header', async () => {
    (window.maestro.invoke as any).mockResolvedValue([]);

    renderWithProviders(<TodoList workspaceId="ws1" />);
    await waitFor(() => {
      expect(screen.getByText('Todos')).toBeInTheDocument();
    });
  });
});
