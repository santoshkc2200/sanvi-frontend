import { expect, test } from '@playwright/test'
import { E2E_BUILD_STAMP } from './fixtures/build-stamp'

// Marketing has no backend alongside its preview server, so the endpoint
// leg is the fixture itself: the playwright config pins the same SANVI_*
// env the build embedded, and the fixture is what `GET /api/v1/system/build`
// returns for a build of this release train. The storefront spec proves the
// endpoint-comparison end to end against a live stand-in; this one proves
// the build → define → `/health` pipeline field for field.
test('health reports the pinned build identity', async ({ request }) => {
  const health = await request.get('/health')
  expect(health.ok()).toBe(true)
  const body = await health.json()

  expect(body.build).toEqual(E2E_BUILD_STAMP)
  expect(body.version).toBeTruthy()
})
