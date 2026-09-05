import { expect, test, type Page } from '@playwright/test'

/**
 * TASK-014 — the storefront conversion beacon, end to end against the mock
 * backend. The beacon posts same-origin (`/api/v1/public/track` on the
 * preview server itself, not the mock API), so these specs intercept it
 * with `page.route` — which is also what lets the "never blocks the render"
 * assertion hold the response back while the page continues to render.
 *
 * Acceptance being covered here:
 * - exactly one beacon per server-issued event id; a refresh fires no second
 * - the beacon never blocks or delays the confirmation render
 * - the beacon carries the site key header the backend authenticates with
 */

interface CapturedBeacon {
  url: string
  siteKey: string | null
  body: {
    event_id: string
    event_name: string
    value: number
    currency: string
    order_ref: string
  }
}

async function collectBeacons(page: Page): Promise<CapturedBeacon[]> {
  const beacons: CapturedBeacon[] = []
  await page.route('**/api/v1/public/track', async (route) => {
    const request = route.request()
    const postData = request.postData() ?? '{}'
    beacons.push({
      url: request.url(),
      siteKey: request.headers()['x-site-key'] ?? null,
      body: JSON.parse(postData),
    })
    await route.fulfill({ status: 202, body: '' })
  })
  return beacons
}

test.describe('storefront conversion beacon (TASK-014)', () => {
  test('a paid order fires exactly one beacon carrying the server-issued event id', async ({
    page,
  }) => {
    const beacons = await collectBeacons(page)

    await page.goto('/checkout/return?id=chk_beacon_1')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Payment confirmed')

    // The beacon goes out fire-and-forget; give it a beat to land.
    await expect.poll(() => beacons.length, { timeout: 5_000 }).toBe(1)
    const beacon = beacons[0]!
    expect(beacon.body.event_id).toBe('conv_e2e_001')
    expect(beacon.body.event_name).toBe('purchase')
    expect(beacon.body.value).toBe(4800)
    expect(beacon.body.currency).toBe('JPY')
    expect(beacon.body.order_ref).toBe('ord-beacon-1')
    // The site key the backend's directive gate authenticates with.
    expect(beacon.siteKey).toBe('e2e-tracking-site-key')

    // A refresh re-renders the confirmation from the same payload — and
    // must fire no second beacon.
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Payment confirmed')
    await page.waitForTimeout(1_000)
    expect(beacons.length).toBe(1)
  })

  test('the beacon never blocks or delays the confirmation render', async ({ page }) => {
    let beaconRequested = false
    let beaconSettled = false

    await page.route('**/api/v1/public/track', async (route) => {
      beaconRequested = true
      // Hold the response: the render must not be waiting on it. A plain
      // timer — `page.waitForTimeout` is unavailable inside route handlers.
      await new Promise((resolve) => setTimeout(resolve, 3_000))
      await route.fulfill({ status: 202, body: '' })
      beaconSettled = true
    })

    await page.goto('/checkout/return?id=chk_beacon_2')
    // The heading renders while the beacon response is still parked — the
    // confirmation was never blocked by the send.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Payment confirmed')
    expect(beaconRequested).toBe(true)
    expect(beaconSettled).toBe(false)
  })

  test('a paid order without a server-issued event id fires no beacon', async ({ page }) => {
    const beacons = await collectBeacons(page)

    await page.goto('/checkout/return?id=chk_noid_1')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Payment confirmed')
    await page.waitForTimeout(1_000)
    // No id from the server, no beacon: the client never mints one.
    expect(beacons.length).toBe(0)
  })
})
