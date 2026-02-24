import { test, expect } from './fixtures';
import { seedProject, seedWorkspace } from './helpers/seed';
import { installMockAgent } from './helpers/mock-agent';
import { createTempGitRepo } from './helpers/git-repo';
import type { Page } from '@playwright/test';

test.describe('Agent Chat', () => {
  test.setTimeout(60000);

  async function setupWithAgent(page: Page, testDataDir: string) {
    await expect(page.getByRole('heading', { name: 'Maestro' })).toBeVisible({ timeout: 10000 });

    // Install mock agent before seeding data
    await installMockAgent(page);

    const repoPath = createTempGitRepo(testDataDir, 'chat-test');
    const project = await seedProject(page, { name: 'chat-test', path: repoPath });
    const workspace = await seedWorkspace(page, {
      projectId: project.id,
      name: 'Chat Workspace',
      branchName: 'feat/chat',
    });

    // Reload so seeded data appears
    await page.reload();
    await expect(page.getByText('chat-test')).toBeVisible({ timeout: 10000 });

    // Select project and workspace
    await page.getByText('chat-test').click();
    await expect(page.getByText('Chat Workspace')).toBeVisible({ timeout: 5000 });
    await page.getByText('Chat Workspace').click();

    // Chat input should be visible by default
    await expect(page.getByPlaceholder('Type a message')).toBeVisible();

    return { project, workspace };
  }

  test('send prompt and receive mock response', async ({ page, testDataDir }) => {
    await setupWithAgent(page, testDataDir);

    // Type a message in the chat input
    const textarea = page.getByPlaceholder('Type a message');
    await textarea.fill('Hello agent');

    // Send with Cmd+Enter (Meta+Enter)
    await textarea.press('Meta+Enter');

    // User message should appear
    await expect(page.getByText('Hello agent')).toBeVisible({ timeout: 10000 });

    // Mock agent echoes back "Echo: <prompt>"
    await expect(page.getByText('Echo: Hello agent')).toBeVisible({ timeout: 15000 });
  });

  test('multiple messages exchange', async ({ page, testDataDir }) => {
    await setupWithAgent(page, testDataDir);

    const textarea = page.getByPlaceholder('Type a message');

    // Send first message
    await textarea.fill('First question');
    await textarea.press('Meta+Enter');
    await expect(page.getByText('Echo: First question')).toBeVisible({ timeout: 15000 });

    // Wait for agent to be ready (status -> waiting) before sending next
    await page.waitForTimeout(500);

    // Send second message
    await textarea.fill('Second question');
    await textarea.press('Meta+Enter');
    await expect(page.getByText('Echo: Second question')).toBeVisible({ timeout: 15000 });

    // Both exchanges should be visible
    await expect(page.getByText('First question', { exact: true })).toBeVisible();
    await expect(page.getByText('Second question', { exact: true })).toBeVisible();
  });
});
