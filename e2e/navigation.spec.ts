import { test, expect } from './fixtures';
import { seedProject, seedWorkspace } from './helpers/seed';
import { createTempGitRepo } from './helpers/git-repo';

test.describe('Navigation', () => {
  test('sidebar toggle hides and shows sidebar', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Maestro' })).toBeVisible({ timeout: 10000 });

    const navbar = page.locator('.mantine-AppShell-navbar');

    // Sidebar should be visible initially — navbar should be on-screen
    await expect.poll(
      async () => {
        const box = await navbar.boundingBox();
        return box ? box.x >= 0 : false;
      },
      { timeout: 5000 },
    ).toBe(true);

    // Click the toggle sidebar button — it's in the main toolbar, not the sidebar
    const mainToolbar = page.locator('.mantine-AppShell-main .titlebar-no-drag').first();
    await mainToolbar.locator('button').first().click();

    // Sidebar should be hidden — navbar should be off-screen (translateX negative)
    await expect.poll(
      async () => {
        const box = await navbar.boundingBox();
        return box ? box.x + box.width <= 0 : true;
      },
      { timeout: 5000 },
    ).toBe(true);

    // Click again to show
    await mainToolbar.locator('button').first().click();

    // Navbar should be back on-screen
    await expect.poll(
      async () => {
        const box = await navbar.boundingBox();
        return box ? box.x >= 0 : false;
      },
      { timeout: 5000 },
    ).toBe(true);
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
    await expect(page.getByText('proj-one')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('proj-two')).toBeVisible();

    // Click proj-one — should show WS Alpha
    await page.getByText('proj-one').click();
    await expect(page.getByText('WS Alpha')).toBeVisible({ timeout: 5000 });

    // Click proj-two — should show WS Beta
    await page.getByText('proj-two').click();
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
    await page.getByText('nav-test').click();
    await expect(page.getByText('My Workspace')).toBeVisible({ timeout: 5000 });

    // Click the workspace in sidebar
    await page.getByText('My Workspace').click();

    // WorkspaceView header should show the branch in the main content area
    const mainArea = page.locator('.mantine-AppShell-main');
    await expect(mainArea.getByText('feat/nav')).toBeVisible({ timeout: 5000 });

    // Tab bar should be visible
    await expect(page.getByRole('tab', { name: 'Chat' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Todos' })).toBeVisible();
  });
});
