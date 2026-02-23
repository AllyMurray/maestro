import { Drawer, Stack, Text, Button } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { PRView } from './PRView';
import { PRCreator } from './PRCreator';
import type { Workspace, Project } from '@maestro/shared';

interface PRDrawerProps {
  opened: boolean;
  onClose: () => void;
  workspace: Workspace;
  project: Project;
  onPRCreated: (result: { number: string; url: string }) => void;
}

export function PRDrawer({ opened, onClose, workspace, project, onPRCreated }: PRDrawerProps) {
  const [creatorOpen, { open: openCreator, close: closeCreator }] = useDisclosure(false);

  const handleCreated = (result: { number: string; url: string }) => {
    onPRCreated(result);
    closeCreator();
    onClose();
  };

  return (
    <>
      <Drawer
        opened={opened}
        onClose={onClose}
        title="Pull Request"
        position="right"
        size="lg"
      >
        {workspace.prUrl && workspace.prNumber && project.gitPlatform ? (
          <PRView
            repoPath={project.path}
            platform={project.gitPlatform}
            prId={workspace.prNumber}
          />
        ) : project.gitPlatform ? (
          <Stack align="center" justify="center" h={300} gap="md">
            <Text c="dimmed">No pull request yet</Text>
            <Button onClick={openCreator}>Create Pull Request</Button>
          </Stack>
        ) : (
          <Stack align="center" justify="center" h={300}>
            <Text c="dimmed">No git platform detected</Text>
          </Stack>
        )}
      </Drawer>

      {project.gitPlatform && (
        <PRCreator
          opened={creatorOpen}
          onClose={closeCreator}
          workspaceId={workspace.id}
          repoPath={project.path}
          platform={project.gitPlatform}
          headBranch={workspace.branchName}
          targetBranch={workspace.targetBranch}
          onCreated={handleCreated}
        />
      )}
    </>
  );
}
