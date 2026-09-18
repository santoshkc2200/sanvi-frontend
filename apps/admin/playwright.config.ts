import { defineConfig, devices } from '@playwright/test'
import { E2E_BUILD_STAMP } from './e2e/fixtures/build-stamp'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4175',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm build && pnpm preview',
    url: 'http://localhost:4175',
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_API_ORIGIN: 'http://localhost:8080',
      // Same-origin as the preview server: the creative uploader's media
      // calls stay on the page's own origin, so the route mocks answer
      // them without a cross-origin round trip (production fronts media
      // through the same-site gateway the same way).
      VITE_MEDIA_ORIGIN: 'http://localhost:4175',
      VITE_STRIPE_PUBLISHABLE_KEY: 'pk_test_e2e_fake_key',
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
  ],
})
