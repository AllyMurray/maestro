import { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Tabs,
  Stack,
  TextInput,
  PasswordInput,
  Select,
  Switch,
  Group,
  Text,
  Button,
  Badge,
  Paper,
} from '@mantine/core';
import { ipc } from '../services/ipc';
import { IPC_CHANNELS } from '@maestro/shared';

interface SettingsDialogProps {
  opened: boolean;
  onClose: () => void;
}

export function SettingsDialog({ opened, onClose }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<string | null>('agents');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [cursorKey, setCursorKey] = useState('');
  const [defaultAgent, setDefaultAgent] = useState<string | null>('claude-code');
  const [claudeModel, setClaudeModel] = useState('');
  const [availableAgents, setAvailableAgents] = useState<
    Array<{ type: string; displayName: string; available: boolean; version?: string }>
  >([]);

  useEffect(() => {
    if (!opened) return;
    // Load settings
    Promise.all([
      ipc.invoke<string | null>(IPC_CHANNELS.CONFIG_GET, 'anthropic_api_key'),
      ipc.invoke<string | null>(IPC_CHANNELS.CONFIG_GET, 'openai_api_key'),
      ipc.invoke<string | null>(IPC_CHANNELS.CONFIG_GET, 'cursor_api_key'),
      ipc.invoke<string | null>(IPC_CHANNELS.CONFIG_GET, 'default_agent'),
      ipc.invoke<string | null>(IPC_CHANNELS.CONFIG_GET, 'claude_model'),
      ipc.invoke(IPC_CHANNELS.AGENT_LIST_AVAILABLE),
    ]).then(([ak, ok, ck, da, cm, agents]) => {
      if (ak) setAnthropicKey(ak);
      if (ok) setOpenaiKey(ok);
      if (ck) setCursorKey(ck);
      if (da) setDefaultAgent(da);
      if (cm) setClaudeModel(cm);
      setAvailableAgents(agents as typeof availableAgents);
    });
  }, [opened]);

  const handleSave = useCallback(async () => {
    await Promise.all([
      anthropicKey && ipc.invoke(IPC_CHANNELS.CONFIG_SET, 'anthropic_api_key', anthropicKey),
      openaiKey && ipc.invoke(IPC_CHANNELS.CONFIG_SET, 'openai_api_key', openaiKey),
      cursorKey && ipc.invoke(IPC_CHANNELS.CONFIG_SET, 'cursor_api_key', cursorKey),
      defaultAgent && ipc.invoke(IPC_CHANNELS.CONFIG_SET, 'default_agent', defaultAgent),
      claudeModel && ipc.invoke(IPC_CHANNELS.CONFIG_SET, 'claude_model', claudeModel),
    ]);
    onClose();
  }, [anthropicKey, openaiKey, cursorKey, defaultAgent, claudeModel, onClose]);

  return (
    <Modal opened={opened} onClose={onClose} title="Settings" size="lg">
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="agents">Agents</Tabs.Tab>
          <Tabs.Tab value="api-keys">API Keys</Tabs.Tab>
          <Tabs.Tab value="general">General</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="agents" pt="md">
          <Stack gap="md">
            <Text size="sm" fw={600}>
              Available Agents
            </Text>
            {availableAgents.map((agent) => (
              <Paper key={agent.type} p="sm" bg="dark.6" radius="sm">
                <Group justify="space-between">
                  <Group gap="sm">
                    <Text size="sm" fw={500}>
                      {agent.displayName}
                    </Text>
                    <Badge
                      size="xs"
                      variant="light"
                      color={agent.available ? 'green' : 'red'}
                    >
                      {agent.available ? 'Installed' : 'Not found'}
                    </Badge>
                  </Group>
                  {agent.version && (
                    <Text size="xs" c="dimmed">
                      {agent.version}
                    </Text>
                  )}
                </Group>
              </Paper>
            ))}

            <Select
              label="Default agent"
              value={defaultAgent}
              onChange={setDefaultAgent}
              data={[
                { value: 'claude-code', label: 'Claude Code' },
                { value: 'codex', label: 'Codex' },
                { value: 'cursor', label: 'Cursor' },
              ]}
            />

            <TextInput
              label="Claude model"
              placeholder="e.g., claude-sonnet-4-20250514"
              value={claudeModel}
              onChange={(e) => setClaudeModel(e.currentTarget.value)}
            />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="api-keys" pt="md">
          <Stack gap="md">
            <PasswordInput
              label="Anthropic API Key"
              placeholder="sk-ant-..."
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.currentTarget.value)}
            />
            <PasswordInput
              label="OpenAI API Key"
              placeholder="sk-..."
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.currentTarget.value)}
            />
            <PasswordInput
              label="Cursor API Key"
              placeholder="..."
              value={cursorKey}
              onChange={(e) => setCursorKey(e.currentTarget.value)}
            />
            <Text size="xs" c="dimmed">
              API keys are stored locally in ~/.maestro/config.json
            </Text>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="general" pt="md">
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Theme follows system preference. More settings coming soon.
            </Text>
          </Stack>
        </Tabs.Panel>
      </Tabs>

      <Group justify="flex-end" mt="xl">
        <Button variant="subtle" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSave}>Save Settings</Button>
      </Group>
    </Modal>
  );
}
