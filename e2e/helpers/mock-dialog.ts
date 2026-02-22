import type { ElectronApplication } from '@playwright/test';

export async function mockSelectDirectory(
  app: ElectronApplication,
  returnPath: string | null,
): Promise<void> {
  await app.evaluate(
    async ({ dialog }, returnPath) => {
      dialog.showOpenDialog = async () =>
        returnPath
          ? { canceled: false, filePaths: [returnPath] }
          : { canceled: true, filePaths: [] };
    },
    returnPath,
  );
}
