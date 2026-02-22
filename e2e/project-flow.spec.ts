import { test, expect } from './fixtures';
import { mockSelectDirectory } from './helpers/mock-dialog';
import { createTempGitRepo } from './helpers/git-repo';
import { getProjectCount } from './helpers/seed';

test.describe('Project Flow', () => {
  test('add project via Open Repository button', async ({ page, electronApp, testDataDir }) => {
    await expect(page.getByRole('heading', { name: 'Maestro' })).toBeVisible({ timeout: 10000 });

    // Create a real git repo for the project (PROJECT_CREATE runs git commands)
    const repoPath = createTempGitRepo(testDataDir, 'my-project');

    // Mock the native directory dialog to return our repo
    await mockSelectDirectory(electronApp, repoPath);

    // Click the "Open Repository" button in the welcome view
    await page.getByText('Open Repository').click();

    // Project name should appear in the sidebar NavLink
    const sidebar = page.locator('.mantine-AppShell-navbar');
    await expect(sidebar.getByText('my-project')).toBeVisible({ timeout: 10000 });

    // Verify DB has the project
    const count = await getProjectCount(page);
    expect(count).toBe(1);
  });

  test('cancel dialog does nothing', async ({ page, electronApp }) => {
    await expect(page.getByRole('heading', { name: 'Maestro' })).toBeVisible({ timeout: 10000 });

    // Mock dialog to return canceled
    await mockSelectDirectory(electronApp, null);

    await page.getByText('Open Repository').click();

    // Sidebar should still show empty state
    await expect(page.getByText('No projects yet')).toBeVisible();
  });

  test('multiple projects appear in sidebar', async ({ page, electronApp, testDataDir }) => {
    await expect(page.getByRole('heading', { name: 'Maestro' })).toBeVisible({ timeout: 10000 });
    const sidebar = page.locator('.mantine-AppShell-navbar');

    // Add first project
    const repo1 = createTempGitRepo(testDataDir, 'project-alpha');
    await mockSelectDirectory(electronApp, repo1);
    await page.getByText('Open Repository').click();
    await expect(sidebar.getByText('project-alpha')).toBeVisible({ timeout: 10000 });

    // Add second project via the sidebar "Add project" button
    const repo2 = createTempGitRepo(testDataDir, 'project-beta');
    await mockSelectDirectory(electronApp, repo2);
    // The + button is in the sidebar's header row (the titlebar-drag group)
    await sidebar.locator('.titlebar-drag button').click();
    await expect(sidebar.getByText('project-beta')).toBeVisible({ timeout: 10000 });

    // Both projects should be in sidebar
    await expect(sidebar.getByText('project-alpha')).toBeVisible();
    await expect(sidebar.getByText('project-beta')).toBeVisible();

    // Click project-alpha to select it
    await sidebar.getByText('project-alpha').click();
    // Verify it shows workspace area for project-alpha
    await expect(sidebar.getByText('No workspaces')).toBeVisible({ timeout: 5000 });
  });
});
