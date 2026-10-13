import { defineConfig } from '@playwright/test';
import process from 'node:process';

export default defineConfig({
  testDir: './e2e',
  timeout: 180_000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4175/ioctl/',
    headless: true,
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      args: ['--disable-dev-shm-usage'],
    },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node scripts/serve-test.mjs',
    url: 'http://127.0.0.1:4175/ioctl/',
    reuseExistingServer: false,
  },
});
