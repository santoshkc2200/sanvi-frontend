import { defineConfig, devices } from '@playwright/test'

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
    },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
})
