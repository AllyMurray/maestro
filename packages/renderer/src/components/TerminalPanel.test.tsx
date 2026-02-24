import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '../__test-utils__/render';
import { TerminalPanel } from './TerminalPanel';
import { IPC_CHANNELS } from '@maestro/shared';

const xtermMocks = vi.hoisted(() => ({
  terminalOpen: vi.fn(),
  terminalWrite: vi.fn(),
  terminalDispose: vi.fn(),
  terminalFocus: vi.fn(),
  terminalOnData: vi.fn(),
  terminalOnResize: vi.fn(),
  terminalLoadAddon: vi.fn(),
  fitAddonFit: vi.fn(),
}));

vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    cols = 80;
    rows = 24;
    loadAddon = xtermMocks.terminalLoadAddon;
    open = xtermMocks.terminalOpen;
    write = xtermMocks.terminalWrite;
    dispose = xtermMocks.terminalDispose;
    focus = xtermMocks.terminalFocus;
    onData = xtermMocks.terminalOnData;
    onResize = xtermMocks.terminalOnResize;
  },
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class {
    fit = xtermMocks.fitAddonFit;
  },
}));

describe('TerminalPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    let counter = 0;
    (window.maestro.invoke as any).mockImplementation((channel: string) => {
      if (channel === IPC_CHANNELS.TERMINAL_CREATE) {
        counter += 1;
        return Promise.resolve({ id: `term-${counter}` });
      }
      return Promise.resolve({ success: true });
    });
    (window.maestro.on as any).mockReturnValue(() => {});
  });

  it('creates terminal on mount and closes on unmount', async () => {
    const { unmount } = renderWithProviders(<TerminalPanel workspacePath="/tmp/ws" />);

    await waitFor(() => {
      expect(window.maestro.invoke).toHaveBeenCalledWith(IPC_CHANNELS.TERMINAL_CREATE, {
        workspacePath: '/tmp/ws',
        cols: 80,
        rows: 24,
      });
    });

    expect(window.maestro.on).toHaveBeenCalledWith(
      IPC_CHANNELS.TERMINAL_DATA,
      expect.any(Function),
    );
    expect(xtermMocks.terminalOpen).toHaveBeenCalled();
    expect(xtermMocks.fitAddonFit).toHaveBeenCalled();

    unmount();
    expect(window.maestro.invoke).toHaveBeenCalledWith(IPC_CHANNELS.TERMINAL_CLOSE, 'term-1');
  });

  it('new terminal button creates a replacement terminal', async () => {
    renderWithProviders(<TerminalPanel workspacePath="/tmp/ws" />);

    await waitFor(() => {
      expect(window.maestro.invoke).toHaveBeenCalledWith(
        IPC_CHANNELS.TERMINAL_CREATE,
        expect.objectContaining({ workspacePath: '/tmp/ws' }),
      );
    });

    const button = screen.getByRole('button');
    await userEvent.click(button);

    await waitFor(() => {
      expect(window.maestro.invoke).toHaveBeenCalledWith(IPC_CHANNELS.TERMINAL_CLOSE, 'term-1');
      expect(window.maestro.invoke).toHaveBeenCalledWith(
        IPC_CHANNELS.TERMINAL_CREATE,
        expect.objectContaining({ workspacePath: '/tmp/ws' }),
      );
    });
  });
});
