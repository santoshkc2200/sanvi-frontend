import { expect, test } from '@playwright/test'
import { E2E_BUILD_STAMP } from './fixtures/build-stamp'

// The storefront's mock API is the stand-in for the backend; the playwright
// config pins the same SANVI_* env on the mock and on the build, so "the app
// reports the same sha GET /api/v1/system/build returns" is assertable
// field-for-field against a live endpoint — no live backend required.
const MOCK_BUILD_URL = 'http://localhost:8090/api/v1/system/build'

test('health reports the same build identity GET /api/v1/system/build returns', async ({
  request,
}) => {
  const served = await request.get(MOCK_BUILD_URL)
  expect(served.ok()).toBe(true)
  const servedStamp = await served.json()

  const health = await request.get('/health')
  expect(health.ok()).toBe(true)
  const body = await health.json()

  expect(body.build).toEqual(servedStamp)
  // Pinned by the webServer env — if the define pipeline dropped, renamed or
  // reshaped a field, this fails with exactly the missing/extra field.
  expect(body.build).toEqual(E2E_BUILD_STAMP)
  expect(body.version).toBeTruthy()
})
