import type { Page } from '@playwright/test';

export async function seedProject(
  page: Page,
  data: { name: string; path: string; defaultBranch?: string },
): Promise<{ id: string }> {
  const project = await page.evaluate(async (data) => {
    return (window as any).maestro.invoke('project:create', {
      name: data.name,
      path: data.path,
      defaultBranch: data.defaultBranch || 'main',
    });
  }, data);
  return { id: project.id };
}

export async function seedWorkspace(
  page: Page,
  data: { projectId: string; name: string; branchName: string; targetBranch?: string },
): Promise<{ id: string }> {
  const workspace = await page.evaluate(async (data) => {
    return (window as any).maestro.invoke('workspace:create', {
      projectId: data.projectId,
      name: data.name,
      branchName: data.branchName,
      targetBranch: data.targetBranch || 'main',
    });
  }, data);
  return { id: workspace.id };
}

export async function seedTodo(
  page: Page,
  data: { workspaceId: string; title: string; blocksMerge?: boolean },
): Promise<{ id: number }> {
  const result = await page.evaluate(async (data) => {
    return (window as any).maestro.invoke('todo:create', {
      workspaceId: data.workspaceId,
      title: data.title,
      blocksMerge: data.blocksMerge !== false,
    });
  }, data);
  return { id: result.id };
}

export async function getProjectCount(page: Page): Promise<number> {
  const projects = await page.evaluate(async () => {
    return (window as any).maestro.invoke('project:list');
  });
  return projects.length;
}
