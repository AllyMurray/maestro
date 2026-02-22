import { useState, useCallback } from 'react';
import { Modal, TextInput, Textarea, Stack, Button, Group, Select, Switch } from '@mantine/core';
import { ipc } from '../services/ipc';
import { IPC_CHANNELS } from '@maestro/shared';
import type { GitPlatform, CreatePROptions } from '@maestro/shared';

interface PRCreatorProps {
  opened: boolean;
  onClose: () => void;
  workspaceId: string;
  repoPath: string;
  platform: GitPlatform;
  headBranch: string;
  targetBranch: string;
  onCreated?: (result: { number: string; url: string }) => void;
}

export function PRCreator({
  opened,
  onClose,
  workspaceId,
  repoPath,
  platform,
  headBranch,
  targetBranch,
  onCreated,
}: PRCreatorProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [draft, setDraft] = useState(false);
  const [creating, setCreating] = useState(false);

  const label = platform === 'gitlab' ? 'Merge Request' : 'Pull Request';

  const handleCreate = useCallback(async () => {
    if (!title.trim()) return;

    setCreating(true);
    try {
      const result = await ipc.invoke<{ number: string; url: string }>(IPC_CHANNELS.PR_CREATE, {
        workspaceId,
        repoPath,
        platform,
        opts: {
          title,
          body,
          baseBranch: targetBranch,
          headBranch,
          draft,
        } satisfies CreatePROptions,
      });

      onCreated?.(result);
      onClose();
      setTitle('');
      setBody('');
    } catch (err) {
      console.error(`Failed to create ${label}:`, err);
    } finally {
      setCreating(false);
    }
  }, [title, body, draft, workspaceId, repoPath, platform, headBranch, targetBranch, onCreated, onClose, label]);

  return (
    <Modal opened={opened} onClose={onClose} title={`Create ${label}`} size="lg">
      <Stack gap="md">
        <Group grow>
          <TextInput label="Base branch" value={targetBranch} readOnly variant="filled" />
          <TextInput label="Head branch" value={headBranch} readOnly variant="filled" />
        </Group>

        <TextInput
          label="Title"
          placeholder={`${label} title`}
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
          required
        />

        <Textarea
          label="Description"
          placeholder="Describe your changes..."
          value={body}
          onChange={(e) => setBody(e.currentTarget.value)}
          minRows={5}
          autosize
        />

        <Switch
          label="Create as draft"
          checked={draft}
          onChange={(e) => setDraft(e.currentTarget.checked)}
        />

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} loading={creating} disabled={!title.trim()}>
            Create {label}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
