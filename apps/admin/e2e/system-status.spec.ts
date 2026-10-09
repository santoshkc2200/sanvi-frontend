import { expect, test } from '@playwright/test'
import { mockBackend } from './mock-backend'

/**
 * TASK-025 steps 4+5: the operator-signal banners and the restore state.
 * The hermetic mock answers the probes healthy by default; each spec below
 * overrides the signal (last-registered route wins) and asserts the console
 * follows it with no second manual action.
 */

const READY_DEGRADED = {
  status: 503,
  contentType: 'application/json',
  body: JSON.stringify({
    status: 'degraded',
    checks: [
      { name: 'database', state: 'degraded' },
      { name: 'redis', state: 'degraded' },
    ],
  }),
} as const

const READY_OK = {
  json: { status: 'ok', checks: [{ name: 'database', state: 'ok' }] },
} as const

test.describe('system status degraded banner', () => {
  test('banner appears when the readiness signal degrades and clears on recovery', async ({
    page,
  }) => {
    mockBackend(page)
    await page.route('**/api/v1/system/ready', (route) => route.fulfill(READY_DEGRADED))
    await page.goto('/')
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible({
      timeout: 20_000,
    })

    // Setting the signal shows the banner without a second manual action…
    const banner = page.locator('[data-system-banner="degraded"]')
    await expect(banner).toBeVisible({ timeout: 20_000 })
    await expect(banner.getByText(/Affected: database, redis/)).toBeVisible()
    // …persistent where the user's action would fail: no dismiss control…
    await expect(banner.getByRole('button', { name: 'Close' })).toHaveCount(0)
    // …and linked to the public status page.
    await expect(banner.getByRole('link', { name: 'View status page' })).toHaveAttribute(
      'href',
      /\/status$/,
    )

    // …clearing the signal removes the banner.
    await page.unroute('**/api/v1/system/ready')
    await page.route('**/api/v1/system/ready', (route) => route.fulfill(READY_OK))
    await page.reload()
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.locator('[data-system-banner]')).toHaveCount(0)
  })
})

test.describe('tenant restore status', () => {
  test('a tenant under restore sees the honest restore state, never an empty dataset', async ({
    page,
  }) => {
    mockBackend(page)
    await page.route('**/api/v1/tenant/context', (route) =>
      route.fulfill({
        json: {
          tenant_id: 'dev-acme',
          slug: 'acme',
          display_name: 'Acme Corporation',
          status: 'restoring',
          region: 'us',
          default_locale: 'en',
          resolution_source: 'internal_header',
        },
      }),
    )
    await page.goto('/')
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible({
      timeout: 20_000,
    })

    const restore = page.locator('[data-restore="in-progress"]')
    await expect(restore).toBeVisible({ timeout: 20_000 })
    await expect(restore.getByText('Workspace restore in progress')).toBeVisible()
    // Never an empty dataset: the dashboard's stats and empty states stay out.
    await expect(page.getByText('Pending invitations')).toHaveCount(0)
    await expect(page.getByText('No entitlements yet.')).toHaveCount(0)
  })
})

test.describe('outage screens link to the system status page', () => {
  test('boot failure renders the status link', async ({ page }) => {
    await page.route('**/api/v1/**', (route) => route.abort())
    await page.goto('/')
    await expect(page.getByText('Could not reach the server')).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByRole('link', { name: 'View system status' })).toHaveAttribute(
      'href',
      /\/status$/,
    )
  })
})
