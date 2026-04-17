import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const baseURL = process.env.PLAYWRIGHT_BASE_URL;
if (!baseURL) {
  throw new Error('PLAYWRIGHT_BASE_URL env var is required');
}

const STORAGE_STATE = resolve(__dirname, 'setup/storageState.json');

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }], ['list']],
  globalSetup: resolve(__dirname, 'setup/globalSetup.ts'),
  globalTeardown: resolve(__dirname, 'setup/globalTeardown.ts'),
  use: {
    baseURL,
    video: 'on',
    trace: 'retain-on-failure',
    storageState: STORAGE_STATE,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 1024 } } },
  ],
});
