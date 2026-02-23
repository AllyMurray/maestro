import { useEffect, useState, useCallback } from 'react';
import { Stack, Tabs, Badge, Text } from '@mantine/core';
import { Group as PanelGroup, Panel } from 'react-resizable-panels';
import { ResizeHandle } from './ResizeHandle';
import { FileBrowser } from './FileBrowser';
import { DiffViewer } from './DiffViewer';
import { ChecksPanel } from './ChecksPanel';
import { TerminalPanel } from './TerminalPanel';
import { useAppStore } from '../stores/appStore';
import { ipc } from '../services/ipc';
import { IPC_CHANNELS } from '@maestro/shared';
import type { Workspace, Project, DiffFile } from '@maestro/shared';

interface RightPanelProps {
  workspace: Workspace;
  project: Project;
}

export function RightPanel({ workspace, project }: RightPanelProps) {
  const rightPanelTab = useAppStore((s) => s.rightPanelTab);
  const setRightPanelTab = useAppStore((s) => s.setRightPanelTab);
  const [changeCount, setChangeCount] = useState(0);

  // Load diff file count for badge
  const loadChanges = useCallback(async () => {
    if (!workspace.worktreePath) return;
    try {
      const result = await ipc.invoke<DiffFile[]>(IPC_CHANNELS.GIT_DIFF_FILES, {
        workspacePath: workspace.worktreePath,
      });
      setChangeCount(Array.isArray(result) ? result.length : 0);
    } catch {
      setChangeCount(0);
    }
  }, [workspace.worktreePath]);

  useEffect(() => {
    loadChanges();
    const interval = setInterval(loadChanges, 10000);
    return () => clearInterval(interval);
  }, [loadChanges]);

  return (
    <PanelGroup orientation="vertical" style={{ height: '100%' }}>
      {/* Top: Tabs area */}
      <Panel id="right-top" defaultSize="60%" minSize="20%">
        <Stack h="100%" gap={0}>
          <Tabs
            value={rightPanelTab}
            onChange={(val) => val && setRightPanelTab(val as typeof rightPanelTab)}
            style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
          >
            <Tabs.List>
              <Tabs.Tab value="files">All files</Tabs.Tab>
              <Tabs.Tab
                value="changes"
                rightSection={
                  changeCount > 0 ? (
                    <Badge size="xs" variant="filled" color="blue" circle>
                      {changeCount}
                    </Badge>
                  ) : null
                }
              >
                Changes
              </Tabs.Tab>
              {workspace.prNumber && project.gitPlatform && (
                <Tabs.Tab value="checks">Checks</Tabs.Tab>
              )}
            </Tabs.List>

            <Tabs.Panel value="files" style={{ flex: 1, overflow: 'hidden' }}>
              {workspace.worktreePath ? (
                <FileBrowser workspacePath={workspace.worktreePath} />
              ) : (
                <Text size="sm" c="dimmed" p="md" ta="center">
                  No worktree path
                </Text>
              )}
            </Tabs.Panel>

            <Tabs.Panel value="changes" style={{ flex: 1, overflow: 'hidden' }}>
              {workspace.worktreePath ? (
                <DiffViewer workspacePath={workspace.worktreePath} />
              ) : (
                <Text size="sm" c="dimmed" p="md" ta="center">
                  No worktree path
                </Text>
              )}
            </Tabs.Panel>

            {workspace.prNumber && project.gitPlatform && (
              <Tabs.Panel value="checks" style={{ flex: 1, overflow: 'auto' }}>
                <ChecksPanel
                  repoPath={project.path}
                  platform={project.gitPlatform}
                  prRef={workspace.prNumber}
                />
              </Tabs.Panel>
            )}
          </Tabs>
        </Stack>
      </Panel>

      <ResizeHandle direction="vertical" />

      {/* Bottom: Terminal */}
      <Panel id="right-bottom" defaultSize="40%" minSize="15%">
        {workspace.worktreePath ? (
          <TerminalPanel workspacePath={workspace.worktreePath} />
        ) : (
          <Stack align="center" justify="center" h="100%">
            <Text c="dimmed" size="sm">
              No worktree path
            </Text>
          </Stack>
        )}
      </Panel>
    </PanelGroup>
  );
}
