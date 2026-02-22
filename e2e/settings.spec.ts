import fs from 'fs';
import path from 'path';
import { test, expect } from './fixtures';
import { installMockAgent } from './helpers/mock-agent';

test.describe('Settings', () => {
  // Helper to open settings dialog — the settings button is the last button in the right toolbar group
  async function openSettings(page) {
    const toolbarButtons = page.locator('.titlebar-no-drag').last().locator('button');
    await toolbarButtons.last().click();
    await expect(page.getByRole('tab', { name: 'Agents' })).toBeVisible({ timeout: 5000 });
  }

  test('save and restore API key', async ({ page, testDataDir }) => {
    await expect(page.getByRole('heading', { name: 'Maestro' })).toBeVisible({ timeout: 10000 });

    // Open settings
    await openSettings(page);

    // Switch to API Keys tab
    await page.getByRole('tab', { name: 'API Keys' }).click();

    // Fill in Anthropic key
    await page.getByLabel('Anthropic API Key').fill('sk-ant-test-12345');

    // Save settings
    await page.getByRole('button', { name: 'Save Settings' }).click();

    // Reopen settings to verify persistence
    await openSettings(page);
    await page.getByRole('tab', { name: 'API Keys' }).click();

    // The field should have the saved value
    await expect(page.getByLabel('Anthropic API Key')).toHaveValue('sk-ant-test-12345');

    // Verify config.json on disk
    const configPath = path.join(testDataDir, 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config.anthropic_api_key).toBe('sk-ant-test-12345');
  });

  test('agent discovery shows badges', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Maestro' })).toBeVisible({ timeout: 10000 });

    // Install mock agents before opening settings
    await installMockAgent(page);

    await openSettings(page);

    // Claude Code should show "Installed"
    await expect(page.getByText('Installed')).toBeVisible();

    // Codex and Cursor should show "Not found"
    const notFoundBadges = page.getByText('Not found');
    await expect(notFoundBadges.first()).toBeVisible();
  });

  test('default agent selection persists', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Maestro' })).toBeVisible({ timeout: 10000 });

    await openSettings(page);

    // Change default agent to Codex — the Select component renders an input
    await page.getByRole('textbox', { name: 'Default agent' }).click();
    await page.getByRole('option', { name: 'Codex' }).click();

    // Save
    await page.getByRole('button', { name: 'Save Settings' }).click();

    // Reopen and verify
    await openSettings(page);
    await expect(page.getByRole('textbox', { name: 'Default agent' })).toHaveValue('Codex');
  });
});
