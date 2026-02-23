import { Drawer } from '@mantine/core';
import { CheckpointTimeline } from './CheckpointTimeline';

interface CheckpointsDrawerProps {
  opened: boolean;
  onClose: () => void;
  workspaceId: string;
  workspacePath: string | null;
}

export function CheckpointsDrawer({ opened, onClose, workspaceId, workspacePath }: CheckpointsDrawerProps) {
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title="Checkpoints"
      position="right"
      size="md"
    >
      {workspacePath ? (
        <CheckpointTimeline workspaceId={workspaceId} workspacePath={workspacePath} />
      ) : null}
    </Drawer>
  );
}
