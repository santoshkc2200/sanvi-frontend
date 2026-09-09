import { expect, test } from '@playwright/test'
import { mockAdvertisingBackend } from './mock-advertising-backend'

/**
 * TASK-015 — conversion diagnostics and audience management. The screen
 * must turn "the numbers look wrong" into a specific cause: every taxonomy
 * category speaks for itself, the health banner keeps its two figures
 * separate, a partial success renders per platform, retry exists only for
 * parked rows, and the audience screens state the opt-out removal rule
 * before any action.
 */

test.describe('conversion diagnostics (TASK-015)', () => {
  test('the diagnostics table shows per-platform states and the taxonomy for each outcome', async ({
    page,
  }) => {
    mockAdvertisingBackend(page, { seedConnection: true })
    await page.goto('/advertising/diagnostics')

    const table = page.getByRole('table', { name: 'Recent conversions with their upload story' })
    await expect(table).toBeVisible()

    // The suppressed row names the purpose and the signal source.
    await expect(
      table.getByText(/Suppressed — Sale or sharing for cross-context advertising \(signal: Gpc\)/),
    ).toBeVisible()
    // The late-suppressed row reads as directive, not as an incident.
    await expect(table.getByText('Withdrawn after capture').first()).toBeVisible()
    // The parked row shows its attempts and its fixable category.
    await expect(table.getByText('Attempts: 5')).toBeVisible()
    await expect(table.getByText('Upload error').first()).toBeVisible()

    // Expanding the parked event tells the full story, ending with the
    // platform's own error text.
    await table.getByRole('button', { name: 'Show full story for add_payment_info' }).click()
    const region = page.getByRole('region', { name: /Full story for add_payment_info/ })
    await expect(region).toBeVisible()
    await expect(region.getByText(/Upload error/).first()).toBeVisible()
    await expect(region.getByText('Platform reported: platform returned 500')).toBeVisible()
    // Click ids render masked, never raw.
    await expect(region.getByText(/gclid-e2e/)).toHaveCount(0)
  })

  test('the health banner shows the two figures separately, with the suppression split', async ({
    page,
  }) => {
    mockAdvertisingBackend(page, { seedConnection: true })
    await page.goto('/advertising/diagnostics')

    // 4-event window: 1 browser-signal suppression (25 %) and 1 parked of 3
    // attempted (33 %) — both thresholds crossed, error tone.
    const banner = page.getByRole('region', { name: 'Conversion uploads are failing' })
    await expect(banner).toBeVisible()
    await expect(banner.getByText('Suppression share')).toBeVisible()
    await expect(banner.getByText('Upload failure ratio')).toBeVisible()
    await expect(banner.getByText('25%')).toBeVisible()
    await expect(banner.getByText('33%')).toBeVisible()
    await expect(banner.getByText(/1 browser privacy signal/)).toBeVisible()
  })

  test('the outcome filter isolates each bucket', async ({ page }) => {
    mockAdvertisingBackend(page, { seedConnection: true })
    await page.goto('/advertising/diagnostics')

    const filter = page.getByLabel('Filter by outcome')
    await expect(filter).toBeVisible()
    const table = page.getByRole('table', { name: 'Recent conversions with their upload story' })

    await filter.selectOption('suppressed')
    await expect(table.getByText('Browser privacy signal')).toBeVisible()
    await expect(table.getByText('Parked')).toHaveCount(0)

    await filter.selectOption('upload_issues')
    await expect(table.getByText('Parked').first()).toBeVisible()

    await filter.selectOption('permitted')
    await expect(table.getByText('Uploaded').first()).toBeVisible()
    await expect(table.getByText('Parked')).toHaveCount(0)
  })

  test('retry renders on the parked row only, retries it, and never on suppressed rows', async ({
    page,
  }) => {
    mockAdvertisingBackend(page, { seedConnection: true })
    await page.goto('/advertising/diagnostics')

    const table = page.getByRole('table', { name: 'Recent conversions with their upload story' })

    // Exactly one retry control in the whole table — the parked event's.
    await expect(table.getByRole('button', { name: /Retry upload/ })).toHaveCount(1)

    await table.getByRole('button', { name: /Retry upload/ }).click()
    // The retry re-queued the event: the row flips to pending, and with no
    // parked row left the retry control disappears entirely.
    await expect(table.getByText('Pending upload').first()).toBeVisible()
    await expect(table.getByRole('button', { name: /Retry upload/ })).toHaveCount(0)
  })

  test('the paused state shows when tracking is disabled, with the retained events', async ({
    page,
  }) => {
    mockAdvertisingBackend(page, { seedConnection: true, trackingDisabled: true })
    await page.goto('/advertising/diagnostics')

    await expect(page.getByText('Conversion tracking is paused')).toBeVisible()
    await expect(
      page.getByText(/the upload workers stop and events wait in the queue/),
    ).toBeVisible()
    await expect(
      page.getByRole('table', { name: 'Recent conversions with their upload story' }),
    ).toBeVisible()
  })
})

test.describe('audience management (TASK-015)', () => {
  test('states the opt-out removal rule before build and refresh, and lists audiences', async ({
    page,
  }) => {
    mockAdvertisingBackend(page, { seedConnection: true })
    await page.goto('/advertising/audiences')

    const rule = page.getByText('Opt-outs are removed on refresh')
    await expect(rule).toBeVisible()
    await expect(
      page.getByText(/a refresh or a rebuild never re-adds an opted-out subject/),
    ).toBeVisible()

    // The rule reads before the build form and before the refresh action.
    const buildHeading = page.getByRole('heading', { name: 'Build an audience' })
    const ruleBox = (await rule.boundingBox())!
    const buildBox = (await buildHeading.boundingBox())!
    const refreshBox = (await page
      .getByRole('button', { name: /Refresh/ })
      .first()
      .boundingBox())!
    expect(ruleBox.y).toBeLessThan(buildBox.y)
    expect(ruleBox.y).toBeLessThan(refreshBox.y)

    const table = page.getByRole('table', { name: 'Audiences' })
    await expect(table.getByRole('cell', { name: 'Purchasers 90d', exact: true })).toBeVisible()
    await expect(table.getByRole('cell', { name: 'Repeat buyers', exact: true })).toBeVisible()
    await expect(table.getByText('Building')).toBeVisible()
    await expect(table.getByText('Active')).toBeVisible()
    // Members are hashes only — the note renders per row.
    await expect(table.getByText(/Members are stored as hashes only/).first()).toBeVisible()
  })

  test('builds an audience and refreshes it, with the refresh removing opted-out subjects', async ({
    page,
  }) => {
    const mock = mockAdvertisingBackend(page, { seedConnection: true })
    await page.goto('/advertising/audiences')

    await page.getByLabel(/Audience name/).fill('Cart abandoners')
    await page.getByLabel(/Platform/).selectOption('meta')
    await page.getByRole('button', { name: 'Build audience' }).click()

    const table = page.getByRole('table', { name: 'Audiences' })
    await expect(table.getByRole('cell', { name: 'Cart abandoners', exact: true })).toBeVisible()

    await table.getByRole('button', { name: /Refresh\s*:\s*Repeat buyers/ }).click()
    await expect.poll(() => mock.audienceRefreshCount()).toBe(1)
    // The refreshed row re-rendered with its new sync time.
    await expect(table.getByText(/Sep 8, 2026/)).toBeVisible()
  })
})
