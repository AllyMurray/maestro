import { Select, Group, Text, Badge } from '@mantine/core';
import type { AgentType } from '@maestro/shared';

interface AgentOption {
  value: AgentType;
  label: string;
  available: boolean;
}

interface AgentSelectorProps {
  value: AgentType | null;
  onChange: (value: AgentType) => void;
  availableAgents?: AgentOption[];
}

const DEFAULT_AGENTS: AgentOption[] = [
  { value: 'claude-code', label: 'Claude Code', available: false },
  { value: 'codex', label: 'Codex', available: false },
  { value: 'cursor', label: 'Cursor', available: false },
];

export function AgentSelector({ value, onChange, availableAgents }: AgentSelectorProps) {
  const agents = availableAgents || DEFAULT_AGENTS;

  const data = agents.map((a) => ({
    value: a.value,
    label: `${a.label}${a.available ? '' : ' (not found)'}`,
    disabled: !a.available,
  }));

  return (
    <Select
      label="AI Agent"
      placeholder="Select an agent"
      data={data}
      value={value}
      onChange={(v) => v && onChange(v as AgentType)}
      allowDeselect={false}
    />
  );
}
