import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { mockBackend } from './mock-backend'

/**
 * The usage & quota surface (TASK-026 step 3–4). The backend owns the
 * numbers; these specs pin the frontend contract against the hermetic mock:
 * the rendered figures equal the mocked `GET /api/v1/tenant/usage` response
 * verbatim, unmetered dimensions are absent rather than broken, every
 * limit-reached state reads specifically to its dimension, and a `429`
 * resolves to the rate notice — never a spinner that never resolves.
 */

const PERIOD_START = '2026-10-01T00:00:00Z'
const PERIOD_END = '2026-11-01T00:00:00Z'

function usageBody(dimensions: Record<string, { used: number; limit: number }>) {
  return {
    plan: 'starter',
    period_start: PERIOD_START,
    period_end: PERIOD_END,
    dimensions,
  }
}

async function scan(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).exclude('.sanvi-visually-hidden').analyze()
  return results.violations
    .filter((violation) => violation.impact === 'critical' || violation.impact === 'serious')
    .map((violation) => `${violation.id} (${violation.impact}): ${violation.nodes.length} node(s)`)
}

test.describe('Usage quota dashboard (11.7)', () => {
  test.beforeEach(async ({ page }) => {
    mockBackend(page)
  })

  test('renders the numbers the usage endpoint returns, verbatim', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })
    // Registered after mockBackend's fallback so this answer wins.
    await page.route('**/api/v1/tenant/usage', (route) =>
      route.fulfill({
        json: usageBody({
          api_requests: { used: 500, limit: 10_000 },
          seats: { used: 4, limit: 5 },
        }),
      }),
    )

    await page.goto('/usage')
    await expect(page.getByRole('heading', { name: 'Usage', exact: true })).toBeVisible()
    // The number shown is the number enforcement uses — exact figures, not estimates.
    await expect(page.getByText('500 / 10,000')).toBeVisible()
    await expect(page.getByText('4 / 5')).toBeVisible()
    // Warning state (4/5 = 80%) names the dimension and links the upgrade path.
    await expect(page.getByText('Seats has used 4 of 5 (80%).')).toBeVisible()
    await expect(page.getByRole('link', { name: 'View plans & upgrade' }).first()).toBeVisible()
    expect(consoleErrors).toEqual([])
  })

  test('omits unmetered dimensions when the flags are off — absent, not broken', async ({
    page,
  }) => {
    await page.route('**/api/v1/tenant/usage', (route) => route.fulfill({ json: usageBody({}) }))

    await page.goto('/usage')
    await expect(page.getByRole('heading', { name: 'Usage', exact: true })).toBeVisible()
    // No limit line anywhere, no error, no spinner left behind.
    await expect(page.getByRole('progressbar')).toHaveCount(0)
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(page.getByText('No entitlements yet.')).toBeVisible()
  })

  test('every limit-reached state is reachable and reads specifically to its dimension', async ({
    page,
  }) => {
    await page.route('**/api/v1/tenant/usage', (route) =>
      route.fulfill({
        json: usageBody({
          api_requests: { used: 10_000, limit: 10_000 },
          tracked_conversions: { used: 250, limit: 200 },
          storage_bytes: { used: 6_000_000_000, limit: 5_000_000_000 },
          custom_domains: { used: 3, limit: 3 },
          seats: { used: 5, limit: 5 },
          notification_sends: { used: 1_001, limit: 1_000 },
        }),
      }),
    )

    await page.goto('/usage')
    await expect(
      page.getByText('API requests has reached its limit (10,000 of 10,000).'),
    ).toBeVisible()
    await expect(
      page.getByText('Tracked conversions has reached its limit (250 of 200).'),
    ).toBeVisible()
    await expect(
      page.getByText('Storage has reached its limit (6,000,000,000 of 5,000,000,000 bytes).'),
    ).toBeVisible()
    await expect(page.getByText('Custom domains has reached its limit (3 of 3).')).toBeVisible()
    await expect(page.getByText('Seats has reached its limit (5 of 5).')).toBeVisible()
    await expect(
      page.getByText('Notification sends has reached its limit (1,001 of 1,000).'),
    ).toBeVisible()
    // Each names the reset time from the usage period.
    await expect(page.getByText(/Usage resets.*2026\./).first()).toBeVisible()
  })

  test('rate-limit on usage load shows the rate notice instead of a spinner', async ({ page }) => {
    await page.route('**/api/v1/tenant/usage', (route) =>
      route.fulfill({
        status: 429,
        headers: { 'content-type': 'application/problem+json', 'retry-after': '0' },
        json: {
          type: 'https://sanvi.app/problems/rate-limited',
          title: 'Too many requests',
          status: 429,
        },
      }),
    )

    await page.goto('/usage')
    await expect(page.getByText('Too many requests. Wait a moment, then try again.')).toBeVisible()
    // The bounded client retry settles: no spinner left behind, page usable.
    await expect(page.getByText('Loading')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Usage', exact: true })).toBeVisible()
  })

  test('the usage page passes axe (critical/serious)', async ({ page }) => {
    await page.route('**/api/v1/tenant/usage', (route) =>
      route.fulfill({
        json: usageBody({
          api_requests: { used: 8_500, limit: 10_000 },
          seats: { used: 5, limit: 5 },
        }),
      }),
    )

    await page.goto('/usage')
    await expect(page.getByText('500 / 10,000').or(page.getByText('8,500 / 10,000'))).toBeVisible()
    expect(await scan(page)).toEqual([])
  })
})
