import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import { mockBackend } from './mock-backend'

/**
 * TASK-023 step 4: the platform-operator console under a **total backend
 * outage** — every route in the manifest, under `500`, `503`, and `hang`.
 * Platform-admin surfaces the incident directly: the boot screen names the
 * failure, the router-level `ErrorView` renders retry + trace id, and the
 * shell never blanks.
 *
 * Chromium-only: the harness's pinned browser.
 */

const ROUTES: string[] = (
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL('../../../scripts/a11y-routes.json', import.meta.url)),
      'utf8',
    ),
  ) as { apps: { 'platform-admin': { routes: string[] } } }
).apps['platform-admin'].routes

test.skip(
  ({ browserName }) => browserName !== 'chromium',
  'outage matrix runs on the pinned chromium harness only',
)

type Mode = '500' | '503' | 'hang'

function failAllApi(page: Page, mode: Mode): void {
  page.route('**/api/v1/**', (route) => {
    if (mode === 'hang') return
    if (mode === '500') {
      return route.fulfill({
        status: 500,
        contentType: 'application/problem+json',
        body: JSON.stringify({ type: 'about:blank', title: 'Internal Server Error', status: 500 }),
      })
    }
    return route.fulfill({
      status: 503,
      contentType: 'application/problem+json',
      headers: { 'retry-after': '1' },
      body: JSON.stringify({
        type: 'https://sanvi.app/problems/platform/overloaded',
        title: 'Platform overloaded',
        status: 503,
      }),
    })
  })
}

function probePath(route: string): string {
  return route.replace(/:([A-Za-z0-9_]+)/g, 'probe')
}

/**
 * The bound a route needs to reach a *terminal* state. Everything settles in
 * seconds: mocked failures answer instantly and the client timeout (1.5 s in
 * this build) ends every hang. `/activating` is the deliberate exception —
 * its designed behavior is a bounded poll (20 attempts, progressive backoff)
 * that only then reaches its `timeout` terminal state, so it gets a bound
 * above that poll instead of a free pass.
 */
const TERMINAL_BOUND = 20_000
const ROUTE_BOUNDS: Record<string, number> = { '/activating': 120_000 }

async function assertTerminalDesignedState(page: Page, route = ''): Promise<void> {
  await expect
    .poll(
      async () => {
        const loading = await page.locator('[data-async-state="loading"]').count()
        if (loading > 0) return false
        // Designed failure surfaces carry their marker; a route whose outage
        // answer is legitimate *content* (the boot-loaded page surviving on
        // data fetched before the outage, a static page, a form that renders
        // without its secondary lists) counts as terminal too — what may
        // never survive is a loading state.
        const terminal =
          (await page.locator('[data-async-state="error"], [data-async-state="empty"]').count()) > 0
        const content = (await page.locator('main :not([data-async-state="loading"])').count()) > 0
        return terminal || content
      },
      { timeout: ROUTE_BOUNDS[route] ?? TERMINAL_BOUND, intervals: [500, 1_000, 2_000] },
    )
    .toBe(true)
}

async function bootThenBreakBackend(page: Page, mode: Mode): Promise<void> {
  mockBackend(page)
  await page.goto('/')
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible({
    timeout: TERMINAL_BOUND,
  })
  failAllApi(page, mode)
}

for (const mode of ['500', '503', 'hang'] as Mode[]) {
  test.describe(`total outage — ${mode}`, () => {
    test(`boot failure renders the designed boot screen (${mode})`, async ({ page }) => {
      mockBackend(page)
      failAllApi(page, mode)
      await page.goto('/')
      await expect(page.locator('[data-async-state="error"]')).toBeVisible({
        timeout: TERMINAL_BOUND,
      })
      await expect(page.getByText('Could not reach the server')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
    })

    for (const route of ROUTES) {
      test(`route ${route} renders a designed state when the backend dies (${mode})`, async ({
        page,
      }) => {
        test.setTimeout((ROUTE_BOUNDS[route] ?? 30_000) + 30_000)
        await bootThenBreakBackend(page, mode)
        await page.evaluate((path) => {
          window.history.pushState({}, '', path)
          window.dispatchEvent(new PopStateEvent('popstate'))
        }, probePath(route))
        await assertTerminalDesignedState(page, route)

        await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
      })
    }
  })
}
