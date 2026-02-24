import { test, expect } from './fixtures';
import { seedProject } from './helpers/seed';
import { installMockAgent } from './helpers/mock-agent';
import { createTempGitRepo } from './helpers/git-repo';

test.describe('Workspace Flow', () => {
  test('create workspace via modal', async ({ page, testDataDir }) => {
    await expect(page.getByRole('heading', { name: 'Maestro' })).toBeVisible({ timeout: 10000 });

    // Install mock agent so the AgentSelector shows agents as available
    await installMockAgent(page);

    // Seed a project
    const repoPath = createTempGitRepo(testDataDir, 'ws-test-repo');
    await seedProject(page, { name: 'ws-test-repo', path: repoPath });

    // Reload the page so the project list refreshes
    await page.reload();
    await expect(page.getByText('ws-test-repo')).toBeVisible({ timeout: 10000 });

    // Click the project to select it
    await page.getByText('ws-test-repo').click();
    // Wait for the "New workspace" button to appear in the toolbar (it only shows when a project is active)
    await page.waitForTimeout(500);

    // Click the "New workspace" button in the toolbar — it's the + button next to workspace name in titlebar
    // The toolbar has a + IconPlus button with tooltip "New workspace (Cmd+N)"
    await page.getByRole('button', { name: 'New workspace' }).first().click();

    // The workspace creator modal should open
    await expect(page.getByRole('heading', { name: 'New Workspace' })).toBeVisible({
      timeout: 5000,
    });

    // Fill in the workspace name
    await page.getByLabel('Workspace name').fill('Add user auth');

    // Verify branch name was auto-populated from workspace name
    const branchInput = page.getByLabel('Branch name');
    await expect(branchInput).toHaveValue('add-user-auth');

    // Select agent (Claude Code is the only available one from our mock)
    await page.getByRole('textbox', { name: 'AI Agent' }).click();
    await page.getByRole('option', { name: /Claude Code/ }).click();

    // Submit the form
    await page.getByRole('button', { name: 'Create Workspace' }).click();

    // After creation, the workspace name should appear in the toolbar header
    // (the toolbar shows activeWorkspace name)
    await expect(page.locator('.titlebar-no-drag').getByText('Add user auth')).toBeVisible({
      timeout: 10000,
    });
  });

  test('branch name auto-generation from workspace name', async ({ page, testDataDir }) => {
    await expect(page.getByRole('heading', { name: 'Maestro' })).toBeVisible({ timeout: 10000 });
    await installMockAgent(page);

    const repoPath = createTempGitRepo(testDataDir, 'branch-test');
    await seedProject(page, { name: 'branch-test', path: repoPath });

    await page.reload();
    await page.getByText('branch-test').click();
    await page.waitForTimeout(500);

    // Open workspace creator via toolbar + button
    await page.getByRole('button', { name: 'New workspace' }).first().click();
    await expect(page.getByRole('heading', { name: 'New Workspace' })).toBeVisible({
      timeout: 5000,
    });

    // Type a workspace name with special characters
    await page.getByLabel('Workspace name').fill('Fix Login Bug #42');

    // Branch should be slugified
    await expect(page.getByLabel('Branch name')).toHaveValue('fix-login-bug-42');
  });

  test('workspace becomes active and shows WorkspaceView header', async ({ page, testDataDir }) => {
    await expect(page.getByRole('heading', { name: 'Maestro' })).toBeVisible({ timeout: 10000 });
    await installMockAgent(page);

    const repoPath = createTempGitRepo(testDataDir, 'header-test');
    await seedProject(page, { name: 'header-test', path: repoPath });

    await page.reload();
    await page.getByText('header-test').click();
    await page.waitForTimeout(500);

    await page.getByRole('button', { name: 'New workspace' }).first().click();
    await expect(page.getByRole('heading', { name: 'New Workspace' })).toBeVisible({
      timeout: 5000,
    });

    await page.getByLabel('Workspace name').fill('My Feature');
    await page.getByRole('textbox', { name: 'AI Agent' }).click();
    await page.getByRole('option', { name: /Claude Code/ }).click();
    await page.getByRole('button', { name: 'Create Workspace' }).click();

    // After creation, workspace name should appear in the toolbar
    await expect(page.locator('.titlebar-no-drag').getByText('My Feature')).toBeVisible({
      timeout: 10000,
    });

    // The branch badge should also be visible in workspace header
    await expect(page.getByTestId('center').getByText('my-feature').first()).toBeVisible();

    // Workspace header actions should be visible
    await expect(page.getByRole('button', { name: 'Open todos' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open checkpoints' })).toBeVisible();
  });
});
