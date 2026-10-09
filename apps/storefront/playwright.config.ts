import { defineConfig, devices } from '@playwright/test'
import { E2E_BUILD_STAMP } from './e2e/fixtures/build-stamp'

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
      // The mock's `GET /api/v1/system/build` serves the same pinned stamp
      // the build below embeds — the release-stamp spec compares them.
      env: {
        SANVI_GIT_COMMIT: E2E_BUILD_STAMP.commit,
        SANVI_BUILT_AT: E2E_BUILD_STAMP.built_at,
        SANVI_ENVIRONMENT: E2E_BUILD_STAMP.environment,
      },
    },
    {
      // `node build` with the env block below, not `pnpm preview` — the
      // script's inline `PORT=…` prefix is POSIX-shell syntax and dies under
      // Playwright's cmd.exe shell on Windows (TASK-023: the outage matrix
      // runs this config on this host). The adapter reads the same variables
      // from the process env either way.
      command: 'pnpm build && node build',
      url: 'http://localhost:4174',
      reuseExistingServer: !process.env.CI,
      // adapter-node reads `$env/dynamic/public` from the process env at
      // runtime: the preview script sets PUBLIC_API_ORIGIN, and Kratos/media
      // get throwaway values here because `getAppEnv()` boots them
      // unconditionally even when no auth flow runs in a spec.
      env: {
        PORT: '4174',
        PUBLIC_API_ORIGIN: 'http://localhost:8090',
        PUBLIC_KRATOS_ORIGIN: 'http://localhost:4433',
        PUBLIC_MEDIA_ORIGIN: 'http://localhost:8091',
        // The conversion beacon's site key — the beacon verifies it is being
        // sent and the specs assert the header. Per-tenant delivery from the
        // backend is the open cross-repo item; the harness sets it as env.
        PUBLIC_TRACKING_SITE_KEY: 'e2e-tracking-site-key',
        // Pins the FR-1103 release stamp `vite.config.ts` bakes into the
        // build — see e2e/fixtures/build-stamp.mjs.
        SANVI_GIT_COMMIT: E2E_BUILD_STAMP.commit,
        SANVI_BUILT_AT: E2E_BUILD_STAMP.built_at,
        SANVI_ENVIRONMENT: E2E_BUILD_STAMP.environment,
        // TASK-023: shortens the tenant cache's fresh window so the outage
        // spec's stale-content case reaches the stale-while-revalidate path
        // in seconds (production default: 30 s — see hooks.server.ts).
        TENANT_CACHE_FRESH_MS: '2000',
      },
    },
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
    {
      // TASK-022 "a throttled run of the critical journeys": the pinned
      // midrange-android network shape (scripts/perf-profiles.json) applied
      // via Playwright networkConditions, scoped to specs tagged
      // `@slow-3g` so the rest of the suite stays unthrottled. The full
      // slow-network/offline suite is TASK-023's.
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
    {
      // TASK-023 (FR-1113): the offline variant — specs tagged `@offline`
      // run under chromium's offline emulation (the specs drive it per
      // context so the un-emulated part of each journey stays real).
      name: 'offline',
      grep: /@offline/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
