import { test, expect } from './fixtures';

test.describe('App Launch', () => {
  test('main window shows welcome heading and Open Repository button', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Maestro' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Open Repository')).toBeVisible();
  });

  test('window has a title', async ({ electronApp }) => {
    const window = await electronApp.firstWindow();
    const title = await window.title();
    expect(title).toBeTruthy();
  });

  test('feature cards are visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Maestro' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Isolated Worktrees')).toBeVisible();
    await expect(page.getByText('Multiple Agents')).toBeVisible();
    await expect(page.getByText('Full PR Lifecycle')).toBeVisible();
  });
});
