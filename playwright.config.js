import { defineConfig } from '@playwright/test';

export default defineConfig ({
  testDir: './tests',
  workers: 1,
  use: {
    baseURL: 'http://localhost:5173',
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] }
  },
  webServer: {
    command: 'npm run dev -- --host localhost',
    url: 'http://localhost:5173',
    reuseExistingServer: ! process.env.CI
  }
});
