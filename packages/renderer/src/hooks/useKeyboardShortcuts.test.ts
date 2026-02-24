import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

const useHotkeys = vi.fn();
const spotlightOpen = vi.fn();

vi.mock('@mantine/hooks', () => ({
  useHotkeys: (...args: unknown[]) => useHotkeys(...args),
}));

vi.mock('@mantine/spotlight', () => ({
  spotlight: {
    open: () => spotlightOpen(),
  },
}));

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers expected hotkeys and opens spotlight', () => {
    const actions = {
      toggleSidebar: vi.fn(),
      toggleRightPanel: vi.fn(),
      newWorkspace: vi.fn(),
      zenMode: vi.fn(),
    };

    renderHook(() => useKeyboardShortcuts(actions));

    expect(useHotkeys).toHaveBeenCalledTimes(1);
    const registered = useHotkeys.mock.calls[0][0] as Array<[string, () => void]>;
    expect(registered.map((r) => r[0])).toEqual(['mod+B', 'mod+J', 'mod+N', 'ctrl+Z', 'mod+K']);

    const openSpotlight = registered.find((r) => r[0] === 'mod+K')?.[1];
    expect(openSpotlight).toBeDefined();
    openSpotlight?.();
    expect(spotlightOpen).toHaveBeenCalledTimes(1);
  });
});
