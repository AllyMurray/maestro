import { useState, useCallback, useEffect } from 'react';
import { Modal, TextInput, Stack, Button, Group, Select } from '@mantine/core';
import { AgentSelector } from './AgentSelector';
import { ipc } from '../services/ipc';
import { IPC_CHANNELS } from '@maestro/shared';
import type { AgentType } from '@maestro/shared';

interface WorkspaceCreatorProps {
  opened: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    branchName: string;
    agentType: AgentType;
    targetBranch: string;
  }) => void;
  projectName?: string;
  defaultBranch?: string;
}

export function WorkspaceCreator({
  opened,
  onClose,
  onSubmit,
  projectName,
  defaultBranch = 'main',
}: WorkspaceCreatorProps) {
  const [name, setName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [agentType, setAgentType] = useState<AgentType | null>(null);
  const [targetBranch, setTargetBranch] = useState(defaultBranch);
  const [availableAgents, setAvailableAgents] = useState<
    { value: AgentType; label: string; available: boolean; reason?: string }[] | undefined
  >();

  useEffect(() => {
    if (!opened) return;
    ipc
      .invoke<{ type: AgentType; displayName: string; available: boolean; reason?: string }[]>(
        IPC_CHANNELS.AGENT_LIST_AVAILABLE,
      )
      .then((agents) => {
        const mappedAgents = agents.map((a) => ({
          value: a.type,
          label: a.displayName,
          available: a.available,
          reason: a.reason,
        }));

        setAvailableAgents(mappedAgents);

        const available = mappedAgents.filter((agent) => agent.available);
        if (available.length === 1) {
          setAgentType((current) => current ?? available[0].value);
        }
      })
      .catch(() => {});
  }, [opened]);

  const handleSubmit = useCallback(() => {
    if (!name || !branchName || !agentType) return;
    onSubmit({ name, branchName, agentType, targetBranch });
    setName('');
    setBranchName('');
    setAgentType(null);
    onClose();
  }, [name, branchName, agentType, targetBranch, onSubmit, onClose]);

  // Auto-generate branch name from workspace name
  const handleNameChange = useCallback((val: string) => {
    setName(val);
    const branch = val
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');
    setBranchName(branch);
  }, []);

  return (
    <Modal opened={opened} onClose={onClose} title="New Workspace" size="md">
      <Stack gap="md">
        <TextInput
          label="Workspace name"
          placeholder="e.g., Add user authentication"
          value={name}
          onChange={(e) => handleNameChange(e.currentTarget.value)}
          required
        />

        <TextInput
          label="Branch name"
          placeholder="e.g., feat/add-user-auth"
          value={branchName}
          onChange={(e) => setBranchName(e.currentTarget.value)}
          required
        />

        <TextInput
          label="Target branch"
          placeholder="main"
          value={targetBranch}
          onChange={(e) => setTargetBranch(e.currentTarget.value)}
        />

        <AgentSelector
          value={agentType}
          onChange={setAgentType}
          availableAgents={availableAgents}
        />

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name || !branchName || !agentType}>
            Create Workspace
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
