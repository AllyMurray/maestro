import { Badge, type MantineColor } from '@mantine/core';
import type { AgentStatus } from '@maestro/shared';

interface AgentStatusBadgeProps {
  status: AgentStatus;
}

const STATUS_CONFIG: Record<AgentStatus, { color: MantineColor; label: string }> = {
  idle: { color: 'gray', label: 'Idle' },
  starting: { color: 'yellow', label: 'Starting' },
  running: { color: 'blue', label: 'Running' },
  waiting: { color: 'green', label: 'Ready' },
  stopped: { color: 'gray', label: 'Stopped' },
  error: { color: 'red', label: 'Error' },
};

export function AgentStatusBadge({ status }: AgentStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.idle;

  return (
    <Badge size="sm" variant="light" color={config.color}>
      {config.label}
    </Badge>
  );
}
