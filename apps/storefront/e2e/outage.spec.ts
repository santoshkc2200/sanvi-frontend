import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'

/**
 * TASK-023 steps 4+5: a simulated **total backend outage**, asserted *per
 * route, not sampled* — every route in the committed route manifest, under
 * all three failure shapes the backend can present:
 *
 * - `500`  — every API call answers an error problem immediately;
 * - `503`  — the backend's shedding contract (`platform/overloaded` +
 *   `Retry-After`);
 * - `hang` — the request is accepted and never answered, so the storefront's
 *   server legs (tenant context 5 s, privacy 3 s) hit their own timeouts.
 *
 * The designed bar (FR-1111): every route renders *some* terminal state —
 * the outage view, a labelled-unavailable section, the stale banner, or the
 * app's `+error` screen — and no `[data-async-state="loading"]` marker
 * survives the bound. The markers are the shared contract the ui primitives
 * emit (TASK-023 step 3); content-only routes simply have content.
 *
 * Chromium-only: the harness's pinned browser (perf-profiles.json) — the
 * matrix is per-route, not per-browser.
 */

const ROUTES: string[] = (
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL('../../../scripts/a11y-routes.json', import.meta.url)),
      'utf8',
    ),
  ) as { apps: { storefront: { routes: string[] } } }
).apps.storefront.routes

test.skip(
  ({ browserName }) => browserName !== 'chromium',
  'outage matrix runs on the pinned chromium harness only',
)

const MODE_HOSTS = {
  '500': 'outage500.localhost:4174',
  '503': 'outage503.localhost:4174',
  hang: 'outagehang.localhost:4174',
} as const

/**
 * The bound a route needs to reach a *terminal* state. Hang navigations pay
 * the server legs' own timeouts (tenant 5 s), so the bound has to sit above
 * them; everything else settles in well under a second past SSR.
 */
const TERMINAL_BOUND = 20_000

/** The route's path with `:id`/`[id]` segments given a fixed probe value. */
function probePath(route: string): string {
  return route.replace(/\[[^\]]+\]/g, 'probe').replace(/:([A-Za-z0-9_]+)/g, 'probe')
}

async function assertTerminalDesignedState(page: Page): Promise<void> {
  // Terminal: no loading marker survives. Designed: some terminal marker
  // (outage view / error view / labelled empty) or a degraded banner renders.
  await expect
    .poll(
      async () => {
        const loading = await page.locator('[data-async-state="loading"]').count()
        const terminal =
          (await page.locator('[data-async-state="error"], [data-async-state="empty"]').count()) > 0
        const staleBanner = (await page.locator('[data-degraded="stale"]').count()) > 0
        const offlineBanner = (await page.locator('[data-connectivity="offline"]').count()) > 0
        return loading === 0 && (terminal || staleBanner || offlineBanner)
      },
      { timeout: TERMINAL_BOUND, intervals: [500, 1_000, 2_000] },
    )
    .toBe(true)
}

for (const [mode, host] of Object.entries(MODE_HOSTS)) {
  test.describe(`total outage — ${mode}`, () => {
    for (const route of ROUTES) {
      test(`route ${route} renders a designed state when the backend is down (${mode})`, async ({
        page,
      }) => {
        await page.goto(`http://${host}${probePath(route)}`, { waitUntil: 'commit' })
        await assertTerminalDesignedState(page)

        // The designed outage never reports success to a crawler/liveness
        // probe masquerade — the shell names the problem.
        const body = await page.locator('body').innerText()
        expect(body.trim().length, 'a designed state renders something').toBeGreaterThan(0)
      })
    }
  })
}

test.describe('stale content — cached tenant says what is stale', () => {
  test('a healthy host whose backend dies mid-session serves cached content with the stale banner', async ({
    request,
    page,
  }) => {
    // Ensure the tenant cache has an entry (other specs share this server
    // process's cache, so it may already be warm — either way this visit
    // leaves a resolution in it).
    await page.goto('http://localhost:4174/', { waitUntil: 'load' })

    // Kill the backend for this host only, then wait out the (e2e-shortened)
    // fresh window so the next resolution takes the stale-while-revalidate
    // path.
    const flipped = await request.patch(
      'http://localhost:8090/__mock/outage?host=localhost:4174&mode=503',
    )
    expect(flipped.ok()).toBeTruthy()
    try {
      await page.waitForTimeout(2_500)
      await page.goto('http://localhost:4174/', { waitUntil: 'load' })

      // Cached content still renders (the shell is up) and *says* it is stale.
      await expect(page.locator('[data-degraded="stale"]')).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText('Some content may be out of date')).toBeVisible()
      await expect(page.getByText('Default Tenant')).toBeVisible()
    } finally {
      await request.patch('http://localhost:8090/__mock/outage?host=localhost:4174&mode=off')
    }
  })
})

test.describe('total outage on the home host — honest copy renders', () => {
  test('the outage view names the problem and offers retry', async ({ page }) => {
    await page.goto('http://outage503.localhost:4174/', { waitUntil: 'load' })
    await expect(page.locator('[data-async-state="error"]')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Sanvi is having a problem right now')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Try again' })).toBeVisible()
  })
})
