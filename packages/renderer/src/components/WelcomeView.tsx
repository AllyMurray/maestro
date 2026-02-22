import { Stack, Title, Text, Button, Group, Paper, SimpleGrid, Box } from '@mantine/core';
import { IconFolder, IconRocket, IconGitBranch, IconTerminal } from './Icons';

export function WelcomeView({ onAddProject }: { onAddProject: () => void }) {
  return (
    <Stack align="center" justify="center" h="100%" gap="xl" p="xl">
      <Stack align="center" gap="sm">
        <Title order={1} c="white">
          Maestro
        </Title>
        <Text size="lg" c="dimmed" ta="center" maw={500}>
          Orchestrate multiple AI coding agents in parallel on isolated git worktrees
        </Text>
      </Stack>

      <Button size="lg" leftSection={<IconFolder size={20} />} variant="filled" onClick={onAddProject}>
        Open Repository
      </Button>

      <SimpleGrid cols={3} spacing="lg" mt="xl" maw={700}>
        <FeatureCard
          icon={<IconGitBranch size={24} />}
          title="Isolated Worktrees"
          description="Each agent works on its own git worktree. No conflicts, no interference."
        />
        <FeatureCard
          icon={<IconRocket size={24} />}
          title="Multiple Agents"
          description="Run Claude Code, Codex, or Cursor side by side."
        />
        <FeatureCard
          icon={<IconTerminal size={24} />}
          title="Full PR Lifecycle"
          description="Create, review, and merge PRs for GitHub and GitLab."
        />
      </SimpleGrid>
    </Stack>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Paper p="lg" bg="dark.6" radius="md" style={{ border: '1px solid var(--mantine-color-dark-4)' }}>
      <Stack gap="sm">
        <Box c="brand.4">{icon}</Box>
        <Text fw={600} size="sm">
          {title}
        </Text>
        <Text size="xs" c="dimmed">
          {description}
        </Text>
      </Stack>
    </Paper>
  );
}
