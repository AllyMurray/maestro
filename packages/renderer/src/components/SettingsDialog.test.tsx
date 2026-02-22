import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '../__test-utils__/render';
import { SettingsDialog } from './SettingsDialog';

describe('SettingsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock: return null for all config gets, empty agents
    (window.maestro.invoke as any).mockImplementation((channel: string) => {
      if (channel === 'agent:list-available') {
        return Promise.resolve([
          { type: 'claude-code', displayName: 'Claude Code', available: true, version: '1.0.0' },
          { type: 'codex', displayName: 'Codex', available: false },
        ]);
      }
      return Promise.resolve(null);
    });
  });

  it('renders nothing when closed', () => {
    renderWithProviders(<SettingsDialog opened={false} onClose={() => {}} />);
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('renders dialog when opened', async () => {
    renderWithProviders(<SettingsDialog opened={true} onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
  });

  it('shows tabs: Agents, API Keys, General', async () => {
    renderWithProviders(<SettingsDialog opened={true} onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Agents')).toBeInTheDocument();
      expect(screen.getByText('API Keys')).toBeInTheDocument();
      expect(screen.getByText('General')).toBeInTheDocument();
    });
  });

  it('shows Save and Cancel buttons', async () => {
    renderWithProviders(<SettingsDialog opened={true} onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Save Settings')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  it('loads available agents on open', async () => {
    renderWithProviders(<SettingsDialog opened={true} onClose={() => {}} />);
    await waitFor(() => {
      // Claude Code appears in agent list and in the default agent dropdown
      const matches = screen.getAllByText('Claude Code');
      expect(matches.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Installed')).toBeInTheDocument();
    });
  });

  it('calls onClose when Cancel is clicked', async () => {
    const { userEvent } = await import('../__test-utils__/render');
    const onClose = vi.fn();
    renderWithProviders(<SettingsDialog opened={true} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('saves settings and closes on Save', async () => {
    const { userEvent } = await import('../__test-utils__/render');
    const onClose = vi.fn();
    renderWithProviders(<SettingsDialog opened={true} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Save Settings')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Save Settings'));
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });
});
