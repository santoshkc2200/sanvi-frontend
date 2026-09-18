import { expect, test } from '@playwright/test'
import { E2E_BUILD_STAMP } from './fixtures/build-stamp'
import { mockBackend } from './mock-backend'

test.beforeEach(async ({ page }) => {
  // Without the mocked console API the boot fails before any route mounts,
  // so `/health` never renders — same arrangement as smoke.spec.ts.
  mockBackend(page)
})

// No backend runs alongside the preview; the fixture is what
// `GET /api/v1/system/build` returns for a build of this release train, and
// the playwright config pinned the same SANVI_* env the build embedded. The
// storefront spec proves the endpoint comparison against a live stand-in;
// this one proves the build → define → `/health` page pipeline field for
// field.
test('health page reports the pinned build identity', async ({ page }) => {
  await page.goto('/health')
  const body = await page.locator('pre').textContent()
  const parsed = JSON.parse(body ?? '{}')

  expect(parsed.build).toEqual(E2E_BUILD_STAMP)
  expect(parsed.version).toBeTruthy()
})
