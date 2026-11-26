import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/live',
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    browserName: 'chromium',
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    trace: 'retain-on-failure',
    viewport: { width: 1440, height: 1100 },
    video: process.env.RECORD_VIDEO === '1'
      ? { mode: 'on', size: { width: 1440, height: 1100 } }
      : 'off',
  },
  webServer: [
    ...(process.env.PLAYWRIGHT_START_BACKEND === '1' ? [{
      command: 'python -m uvicorn app.main:app --host 127.0.0.1 --port 8000',
      cwd: '../backend',
      url: 'http://127.0.0.1:8000/api/health',
      reuseExistingServer: !process.env.CI,
    }] : []),
    {
      command: 'npm run dev -- --port 5173 --strictPort',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
