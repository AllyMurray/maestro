import type { Page } from '@playwright/test';

/**
 * Installs mock agent infrastructure via a test-only IPC handler.
 * Replaces createAgentManager and discoverAgents in the main process.
 */
export async function installMockAgent(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await (window as any).maestro.invoke('test:install-mock-agent');
  });
}
