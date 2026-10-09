import { defineConfig, devices } from '@playwright/test'
import { E2E_BUILD_STAMP } from './e2e/fixtures/build-stamp'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  webServer: {
    // `node build` with the env block below, not `pnpm preview` — the
    // script's inline `PORT=…` prefix is POSIX-shell syntax and dies under
    // Playwright's cmd.exe shell on Windows (TASK-023). Same variables,
    // same values, either way.
    command: 'pnpm build && node build',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    // Pins the FR-1103 release stamp `vite.config.ts` bakes into the build —
    // see e2e/fixtures/build-stamp.mjs.
    env: {
      PORT: '4173',
      PUBLIC_API_ORIGIN: 'http://localhost:8080',
      SANVI_GIT_COMMIT: E2E_BUILD_STAMP.commit,
      SANVI_BUILT_AT: E2E_BUILD_STAMP.built_at,
      SANVI_ENVIRONMENT: E2E_BUILD_STAMP.environment,
    },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
    {
      // TASK-023 (FR-1113): the throttled run of the critical journeys —
      // the pinned midrange-android network shape (perf-profiles.json),
      // scoped to specs tagged `@slow-3g`. The site is static, so this
      // proves the journeys hold on a throttled network, not that an API
      // survives one.
      name: 'slow-3g',
      grep: /@slow-3g/,
      use: {
        ...devices['Pixel 7'],
        networkConditions: {
          download: 184_325, // 1474.6 Kbps
          upload: 84_375, // 675 Kbps
          latency: 562.5, // requestLatencyMs
        },
      },
    },
  ],
})
