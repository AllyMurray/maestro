import { test, expect } from './fixtures';
import { seedProject, seedWorkspace } from './helpers/seed';
import { createTempGitRepo } from './helpers/git-repo';

test.describe('Navigation', () => {
  test('sidebar toggle hides and shows sidebar', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Maestro' })).toBeVisible({ timeout: 10000 });

    // Sidebar should be visible initially
    await expect(page.getByText('Add repository')).toBeVisible();

    const toolbar = page.locator('.titlebar-no-drag').first();

    // Hide sidebar
    await toolbar.locator('button').first().click();
    await expect(page.getByText('Add repository')).not.toBeVisible();

    // Show sidebar again
    await toolbar.locator('button').first().click();
    await expect(page.getByText('Add repository')).toBeVisible();
  });

  test('project switching loads correct workspaces', async ({ page, testDataDir }) => {
    await expect(page.getByRole('heading', { name: 'Maestro' })).toBeVisible({ timeout: 10000 });

    // Seed two projects with distinct workspaces
    const repo1 = createTempGitRepo(testDataDir, 'proj-one');
    const repo2 = createTempGitRepo(testDataDir, 'proj-two');
    const p1 = await seedProject(page, { name: 'proj-one', path: repo1 });
    const p2 = await seedProject(page, { name: 'proj-two', path: repo2 });

    await seedWorkspace(page, { projectId: p1.id, name: 'WS Alpha', branchName: 'alpha' });
    await seedWorkspace(page, { projectId: p2.id, name: 'WS Beta', branchName: 'beta' });

    // Reload so data appears
    await page.reload();

    // Select proj-one — should show WS Alpha
    await page.getByPlaceholder('Select project').click();
    await page.getByRole('option', { name: 'proj-one' }).click();
    await expect(page.getByText('WS Alpha')).toBeVisible({ timeout: 5000 });

    // Select proj-two — should show WS Beta
    await page.getByPlaceholder('Select project').click();
    await page.getByRole('option', { name: 'proj-two' }).click();
    await expect(page.getByText('WS Beta')).toBeVisible({ timeout: 5000 });
  });

  test('workspace selection shows workspace header', async ({ page, testDataDir }) => {
    await expect(page.getByRole('heading', { name: 'Maestro' })).toBeVisible({ timeout: 10000 });

    const repoPath = createTempGitRepo(testDataDir, 'nav-test');
    const project = await seedProject(page, { name: 'nav-test', path: repoPath });
    await seedWorkspace(page, {
      projectId: project.id,
      name: 'My Workspace',
      branchName: 'feat/nav',
    });

    await page.reload();
    await expect(page.getByText('My Workspace')).toBeVisible({ timeout: 5000 });

    // Click the workspace in sidebar
    await page.getByText('My Workspace').click();

    // Workspace header should show the branch name
    await expect(page.getByTestId('center').getByText('feat/nav').first()).toBeVisible({
      timeout: 5000,
    });

    // Workspace header actions should be visible
    await expect(page.getByRole('button', { name: 'Open todos' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open checkpoints' })).toBeVisible();
  });
});
