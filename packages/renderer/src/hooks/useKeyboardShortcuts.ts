import { useHotkeys } from '@mantine/hooks';
import { spotlight } from '@mantine/spotlight';

interface ShortcutActions {
  toggleSidebar: () => void;
  toggleRightPanel: () => void;
  newWorkspace: () => void;
  zenMode: () => void;
}

export function useKeyboardShortcuts(actions: ShortcutActions) {
  useHotkeys([
    ['mod+B', actions.toggleSidebar],
    ['mod+J', actions.toggleRightPanel],
    ['mod+N', actions.newWorkspace],
    ['ctrl+Z', actions.zenMode],
    ['mod+K', () => spotlight.open()],
  ]);
}
