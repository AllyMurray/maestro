import { test, expect } from './fixtures';
import { seedProject, seedWorkspace } from './helpers/seed';
import { installMockAgent } from './helpers/mock-agent';
import { createTempGitRepo } from './helpers/git-repo';

test.describe('Error Flows', () => {
  test.setTimeout(90000);

  async function selectProjectAndWorkspace(
    page: import('@playwright/test').Page,
    project: string,
    workspace: string,
  ) {
    await page.getByText(project).click();
    await expect(page.getByText(workspace)).toBeVisible({ timeout: 5000 });
    await page.getByText(workspace).click();
  }

  test('shows agent error when selected agent is unavailable', async ({ page, testDataDir }) => {
    await expect(page.getByRole('heading', { name: 'Maestro' })).toBeVisible({ timeout: 10000 });
    await installMockAgent(page);

    const repoPath = createTempGitRepo(testDataDir, 'error-agent');
    const project = await seedProject(page, { name: 'error-agent', path: repoPath });
    await seedWorkspace(page, {
      projectId: project.id,
      name: 'Unavailable Agent WS',
      branchName: 'feat/unavailable-agent',
      agentType: 'codex',
    });

    await page.reload();
    await selectProjectAndWorkspace(page, 'error-agent', 'Unavailable Agent WS');

    const input = page.getByPlaceholder('Type a message');
    await input.fill('hello');
    await input.press('Meta+Enter');

    await expect(page.getByText('Agent error')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Codex is unavailable/).first()).toBeVisible({ timeout: 10000 });
  });

  test('handles PR create IPC failure without crashing', async ({ page, testDataDir }) => {
    await expect(page.getByRole('heading', { name: 'Maestro' })).toBeVisible({ timeout: 10000 });

    const repoPath = createTempGitRepo(testDataDir, 'error-pr');
    const project = await seedProject(page, {
      name: 'error-pr',
      path: repoPath,
      gitPlatform: 'github',
    });
    await seedWorkspace(page, {
      projectId: project.id,
      name: 'PR Error WS',
      branchName: 'feat/pr-error',
      agentType: 'claude-code',
    });

    await page.reload();
    await selectProjectAndWorkspace(page, 'error-pr', 'PR Error WS');

    const errorMessage = await page.evaluate(async () => {
      try {
        await (window as any).maestro.invoke('pr:create', {
          workspaceId: 'ws-fail',
          repoPath: '/tmp/repo',
          platform: 'github',
          opts: { title: 't', body: 'b', headBranch: 'h', baseBranch: 'm' },
        });
        return 'no-error';
      } catch (err) {
        return String(err);
      }
    });

    expect(errorMessage).toContain("Error invoking remote method 'pr:create'");
    await expect(page.getByPlaceholder('Type a message')).toBeVisible();
  });

  test('handles issue search IPC failure without crashing', async ({ page, testDataDir }) => {
    await expect(page.getByRole('heading', { name: 'Maestro' })).toBeVisible({ timeout: 10000 });

    const repoPath = createTempGitRepo(testDataDir, 'error-issue');
    const project = await seedProject(page, {
      name: 'error-issue',
      path: repoPath,
      gitPlatform: 'github',
    });
    await seedWorkspace(page, {
      projectId: project.id,
      name: 'Issue Error WS',
      branchName: 'feat/issue-error',
      agentType: 'claude-code',
    });

    await page.reload();
    await selectProjectAndWorkspace(page, 'error-issue', 'Issue Error WS');

    const errorMessage = await page.evaluate(async () => {
      try {
        await (window as any).maestro.invoke('issue:search', {
          repoPath: '/tmp/repo',
          platform: 'github',
          query: 'bug',
        });
        return 'no-error';
      } catch (err) {
        return String(err);
      }
    });

    expect(errorMessage).toContain("Error invoking remote method 'issue:search'");
    await expect(page.getByPlaceholder('Type a message')).toBeVisible();
  });
});
