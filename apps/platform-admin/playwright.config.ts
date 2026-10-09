import { defineConfig, devices } from '@playwright/test'
import { E2E_BUILD_STAMP } from './e2e/fixtures/build-stamp'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4176',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm build && pnpm preview',
    url: 'http://localhost:4176',
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_API_ORIGIN: 'http://localhost:8080',
      // TASK-023: the outage spec's hang mode must end at the client
      // timeout, in seconds not the 10 s default. Sized above the slowest
      // legitimate mocked request — the @slow-3g journey adds ~560 ms
      // latency per call — so only a hung request ever hits it (three
      // attempts ≈ 13 s, inside the outage spec's 20 s terminal bound).
      VITE_API_TIMEOUT_MS: '4000',
      // Pins the FR-1103 release stamp `vite.config.ts` bakes into the
      // build — see e2e/fixtures/build-stamp.mjs.
      SANVI_GIT_COMMIT: E2E_BUILD_STAMP.commit,
      SANVI_BUILT_AT: E2E_BUILD_STAMP.built_at,
      SANVI_ENVIRONMENT: E2E_BUILD_STAMP.environment,
    },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    {
      // TASK-023 (FR-1113): the throttled run of the critical journeys —
      // the pinned midrange-android network shape (perf-profiles.json),
      // scoped to specs tagged `@slow-3g`.
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
