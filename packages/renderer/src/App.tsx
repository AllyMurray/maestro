import { AppShell, Text, Group, Box, ActionIcon, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconSettings, IconLayoutSidebar } from './components/Icons';
import { Sidebar } from './components/Sidebar';
import { WelcomeView } from './components/WelcomeView';
import { WorkspaceView } from './components/WorkspaceView';
import { useAppStore } from './stores/appStore';

export default function App() {
  const [sidebarOpen, { toggle: toggleSidebar }] = useDisclosure(true);
  const activeWorkspaceId = useAppStore((s) => s.activeWorkspaceId);
  const workspaces = useAppStore((s) => s.workspaces);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || null;

  return (
    <AppShell
      navbar={{
        width: 260,
        breakpoint: 'sm',
        collapsed: { desktop: !sidebarOpen, mobile: !sidebarOpen },
      }}
      padding={0}
    >
      <AppShell.Navbar bg="dark.8" style={{ borderRight: '1px solid var(--mantine-color-dark-5)' }}>
        <Sidebar />
      </AppShell.Navbar>

      <AppShell.Main
        style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--mantine-color-dark-7)',
        }}
      >
        {/* Titlebar / toolbar */}
        <Group
          h={52}
          px="md"
          justify="space-between"
          className="titlebar-drag"
          style={{
            borderBottom: '1px solid var(--mantine-color-dark-5)',
            flexShrink: 0,
            paddingLeft: sidebarOpen ? 'var(--mantine-spacing-md)' : 80,
          }}
        >
          <Group gap="xs" className="titlebar-no-drag">
            <Tooltip label="Toggle sidebar" position="bottom">
              <ActionIcon variant="subtle" color="gray" onClick={toggleSidebar}>
                <IconLayoutSidebar size={18} />
              </ActionIcon>
            </Tooltip>
            <Text size="sm" fw={600} c="dimmed">
              {activeWorkspace ? activeWorkspace.name : 'Maestro'}
            </Text>
          </Group>
          <Group gap="xs" className="titlebar-no-drag">
            <Tooltip label="Settings" position="bottom">
              <ActionIcon variant="subtle" color="gray">
                <IconSettings size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        {/* Main content */}
        <Box style={{ flex: 1, overflow: 'hidden' }}>
          {activeWorkspace ? (
            <WorkspaceView workspace={activeWorkspace} />
          ) : (
            <WelcomeView />
          )}
        </Box>
      </AppShell.Main>
    </AppShell>
  );
}
