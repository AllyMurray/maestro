import { test, expect } from './fixtures';
import { seedProject, seedWorkspace } from './helpers/seed';
import { createTempGitRepo } from './helpers/git-repo';
import type { Page } from '@playwright/test';

test.describe('Todo Flow', () => {
  async function setupWorkspace(page: Page, testDataDir: string) {
    await expect(page.getByRole('heading', { name: 'Maestro' })).toBeVisible({ timeout: 10000 });

    const repoPath = createTempGitRepo(testDataDir, 'todo-test');
    const project = await seedProject(page, { name: 'todo-test', path: repoPath });
    const workspace = await seedWorkspace(page, {
      projectId: project.id,
      name: 'Todo Workspace',
      branchName: 'feat/todos',
    });

    // Reload so the seeded data appears
    await page.reload();
    await expect(page.getByText('todo-test')).toBeVisible({ timeout: 10000 });

    // Select the project — this triggers WORKSPACE_LIST load
    await page.getByText('todo-test').click();

    // Wait for workspace to appear in sidebar (now that mapRow is in place)
    await expect(page.getByText('Todo Workspace')).toBeVisible({ timeout: 5000 });

    // Click workspace to activate it
    await page.getByText('Todo Workspace').click();

    // Open Todos drawer from workspace header
    await page.getByRole('button', { name: 'Open todos' }).click();
    await expect(page.getByPlaceholder('Add a todo...')).toBeVisible({ timeout: 5000 });

    return { project, workspace };
  }

  test('create, complete, and delete a todo', async ({ page, testDataDir }) => {
    await setupWorkspace(page, testDataDir);

    // Add a todo
    await page.getByPlaceholder('Add a todo...').fill('Write unit tests');
    await page.getByPlaceholder('Add a todo...').press('Enter');

    // Todo should appear
    await expect(page.getByText('Write unit tests')).toBeVisible({ timeout: 5000 });

    // Completion count shows 0/1
    await expect(page.getByText('0/1')).toBeVisible();

    // Check the checkbox to complete
    await page.getByRole('checkbox').click();
    await expect(page.getByText('1/1')).toBeVisible({ timeout: 5000 });

    // Delete the todo — find the delete ActionIcon (the one with red color near the todo)
    const todoItem = page.locator('.mantine-Paper-root').filter({ hasText: 'Write unit tests' });
    await todoItem.locator('button[data-size="xs"]').click();

    // Todo should be gone
    await expect(page.getByText('Write unit tests')).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText('No todos yet')).toBeVisible();
  });

  test('blocker badge appears and disappears', async ({ page, testDataDir }) => {
    await setupWorkspace(page, testDataDir);

    // Add a todo (blocks merge by default)
    await page.getByPlaceholder('Add a todo...').fill('Fix critical bug');
    await page.getByPlaceholder('Add a todo...').press('Enter');

    await expect(page.getByText('Fix critical bug')).toBeVisible({ timeout: 5000 });

    // Should show "Blocker" badge
    await expect(page.getByText('Blocker')).toBeVisible();

    // Should show "blocking merge" count
    await expect(page.getByText('1 blocking merge')).toBeVisible();

    // Complete the todo
    await page.getByRole('checkbox').click();

    // "blocking merge" count should disappear
    await expect(page.getByText('1 blocking merge')).not.toBeVisible({ timeout: 5000 });
  });

  test('todos persist across tab switches', async ({ page, testDataDir }) => {
    await setupWorkspace(page, testDataDir);

    // Add a todo
    await page.getByPlaceholder('Add a todo...').fill('Persistent todo');
    await page.getByPlaceholder('Add a todo...').press('Enter');
    await expect(page.getByText('Persistent todo')).toBeVisible({ timeout: 5000 });

    // Close and reopen Todos drawer
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Open todos' }).click();

    // Todo should still be there
    await expect(page.getByText('Persistent todo')).toBeVisible({ timeout: 5000 });
  });
});
