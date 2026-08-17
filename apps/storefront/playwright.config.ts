import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4174',
    trace: 'on-first-retry',
  },
  webServer: [
    // Started first — the storefront's own hooks.server.ts hits this on
    // every request (tenant resolution), so it must be up before the
    // storefront's readiness check below can ever succeed.
    {
      command: 'node e2e/fixtures/mock-api-server.mjs',
      url: 'http://localhost:8080/__health',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm build && pnpm preview',
      url: 'http://localhost:4174',
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
})
