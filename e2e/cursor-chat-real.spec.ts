import { execFileSync } from 'child_process';
import { test, expect } from './fixtures';
import { seedProject, seedWorkspace } from './helpers/seed';
import { createTempGitRepo } from './helpers/git-repo';

function commandSucceeds(command: string, args: string[]): boolean {
  try {
    execFileSync(command, args, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

const RUN_REAL_CURSOR_E2E = process.env.MAESTRO_RUN_REAL_CURSOR_E2E === '1';
const HAS_CURSOR =
  commandSucceeds('cursor-agent', ['--version']) ||
  commandSucceeds('cursor', ['agent', '--version']);
const CURSOR_AUTHENTICATED =
  commandSucceeds('cursor-agent', ['status']) || commandSucceeds('cursor', ['agent', 'status']);

test.describe('Cursor Chat Real E2E', () => {
  test.skip(!RUN_REAL_CURSOR_E2E, 'Set MAESTRO_RUN_REAL_CURSOR_E2E=1 to run real Cursor e2e');
  test.skip(!HAS_CURSOR, 'Cursor CLI is not installed');
  test.skip(!CURSOR_AUTHENTICATED, 'Cursor CLI is not authenticated');
  test.setTimeout(180000);

  test('sends a prompt and gets one assistant response', async ({ page, testDataDir }) => {
    await expect(page.getByRole('heading', { name: 'Maestro' })).toBeVisible({ timeout: 10000 });

    const repoPath = createTempGitRepo(testDataDir, 'cursor-chat-real');
    const project = await seedProject(page, { name: 'cursor-chat-real', path: repoPath });
    await seedWorkspace(page, {
      projectId: project.id,
      name: 'Cursor Real Chat',
      branchName: 'feat/cursor-real-chat',
      agentType: 'cursor',
    });

    await page.reload();
    await page.getByText('cursor-chat-real').click();
    await expect(page.getByText('Cursor Real Chat')).toBeVisible({ timeout: 5000 });
    await page.getByText('Cursor Real Chat').click();

    const textarea = page.getByPlaceholder('Type a message');
    await textarea.fill('Reply with exactly: OK');
    await textarea.press('Meta+Enter');

    await expect(page.getByText('Reply with exactly: OK')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('OK').first()).toBeVisible({ timeout: 90000 });
    await expect(page.getByText(/^OKOK$/)).toHaveCount(0);
    await expect(page.getByText(/timed out and was killed/i)).toHaveCount(0);
  });
});
