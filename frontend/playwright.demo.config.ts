import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/demo',
  workers: 1,
  timeout: 120_000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 1440, height: 1100 },
    browserName: 'chromium',
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    video: { mode: 'on', size: { width: 1440, height: 1100 } },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
  },
});
