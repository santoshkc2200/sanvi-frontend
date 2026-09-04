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
      url: 'http://localhost:8090/__health',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm build && pnpm preview',
      url: 'http://localhost:4174',
      reuseExistingServer: !process.env.CI,
      // adapter-node reads `$env/dynamic/public` from the process env at
      // runtime: the preview script sets PUBLIC_API_ORIGIN, and Kratos/media
      // get throwaway values here because `getAppEnv()` boots them
      // unconditionally even when no auth flow runs in a spec.
      env: {
        PUBLIC_API_ORIGIN: 'http://localhost:8090',
        PUBLIC_KRATOS_ORIGIN: 'http://localhost:4433',
        PUBLIC_MEDIA_ORIGIN: 'http://localhost:8091',
        // The conversion beacon's site key — the beacon verifies it is being
        // sent and the specs assert the header. Per-tenant delivery from the
        // backend is the open cross-repo item; the harness sets it as env.
        PUBLIC_TRACKING_SITE_KEY: 'e2e-tracking-site-key',
      },
    },
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
})
