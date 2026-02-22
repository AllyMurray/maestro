import { useEffect } from 'react';
import { useHotkeys } from '@mantine/hooks';
import { spotlight } from '@mantine/spotlight';

interface ShortcutActions {
  toggleSidebar: () => void;
  createPR: () => void;
  openDiff: () => void;
  newWorkspace: () => void;
  zenMode: () => void;
}

export function useKeyboardShortcuts(actions: ShortcutActions) {
  useHotkeys([
    ['mod+B', actions.toggleSidebar],
    ['mod+shift+P', actions.createPR],
    ['mod+D', actions.openDiff],
    ['mod+N', actions.newWorkspace],
    ['ctrl+Z', actions.zenMode],
    ['mod+K', () => spotlight.open()],
  ]);
}
