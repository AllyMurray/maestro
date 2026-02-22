import { test as base, _electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import os from 'os';

type Fixtures = {
  testDataDir: string;
  electronApp: ElectronApplication;
  page: Page;
};

export const test = base.extend<Fixtures>({
  testDataDir: async ({}, use) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-e2e-'));
    await use(dir);
    fs.rmSync(dir, { recursive: true, force: true });
  },

  electronApp: async ({ testDataDir }, use) => {
    const app = await _electron.launch({
      args: [path.join(__dirname, '../packages/main/dist/index.js')],
      env: {
        ...process.env,
        MAESTRO_TEST: '1',
        MAESTRO_TEST_DATA_DIR: testDataDir,
        NODE_ENV: 'test',
      },
    });
    await use(app);
    await app.close();
  },

  page: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await use(page);
  },
});

export { expect } from '@playwright/test';
