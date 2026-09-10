import { expect, test } from '@playwright/test'
import { mockAdvertisingBackend } from './mock-advertising-backend'

/**
 * TASK-017 — budget cap configuration & alert surfaces. The screen's
 * obligation: a cap holds, and auto-pause behaves exactly as the UI said
 * it would. The specs pin the honesty requirements: typed confirmation
 * naming the pause figure and the no-auto-resume rule, the daily and
 * projected monthly delta on a raise, the below-spend warning through the
 * backend's 409, an explicit FX basis for a cross-currency cap, staleness
 * labelled on every figure, and an acknowledgement that round-trips.
 */

test.describe('budget cap configuration (TASK-017)', () => {
  test('renders caps in place with figures, status words, and freshness', async ({ page }) => {
    mockAdvertisingBackend(page, { seedConnection: true, seedTwoCampaigns: true, seedCaps: true })
    await page.goto('/advertising/budget')

    // The second-line disclosure is permanent on the screen — no tooltip.
    await expect(page.getByText(/second line of defence/)).toBeVisible()

    await expect(page.getByRole('heading', { name: 'Caps in place' })).toBeVisible()
    // The tenant cap sits at 80% — the state is words, not only colour.
    await expect(page.getByText('80% — approaching cap').first()).toBeVisible()
    await expect(page.getByText(/¥40,000\s*\/\s*¥50,000/)).toBeVisible()
    // Every figure carries its freshness.
    await expect(page.getByText(/Spend figures last synced/).first()).toBeVisible()
  })

  test('the 100% state is textually distinct from the 80% state', async ({ page }) => {
    mockAdvertisingBackend(page, { seedConnection: true, seedTwoCampaigns: true, seedCaps: true })
    await page.goto('/advertising/budget')

    // The breached campaign cap drives the banner's hit wording…
    await expect(page.getByText('A cap has been reached (100%)')).toBeVisible()
    await expect(page.getByText('Cap reached').first()).toBeVisible()
    // …while the tenant card still reads the 80% wording — two different
    // sentences, distinguishable without colour.
    await expect(page.getByText('80% — approaching cap').first()).toBeVisible()
  })

  test('with no breach the highest-severity banner is the 80% warning', async ({ page }) => {
    mockAdvertisingBackend(page, {
      seedConnection: true,
      seedTwoCampaigns: true,
      seedCaps: true,
      seedCapsWarnOnly: true,
    })
    await page.goto('/advertising/budget')

    await expect(page.getByText('A cap is close to its limit (80% reached)')).toBeVisible()
    await expect(page.getByText('A cap has been reached (100%)')).toHaveCount(0)
  })

  test('raising a cap shows the period delta and its 30-day projection before saving', async ({
    page,
  }) => {
    const mock = mockAdvertisingBackend(page, {
      seedConnection: true,
      seedTwoCampaigns: true,
      seedCaps: true,
    })
    await page.goto('/advertising/budget')

    // Raise the tenant monthly cap: 50,000 → 80,000. Auto-pause (on in the
    // seed) goes off first, so this dialog is the pure raise confirmation.
    const tenantCard = page.locator('.budget__cap', { hasText: 'All campaigns' })
    await tenantCard.getByRole('button', { name: 'Edit' }).click()
    await page.getByLabel('Cap amount (JPY)').fill('80000')
    await page.getByLabel('At 100% of the cap').selectOption('false')
    await page.getByRole('button', { name: 'Save cap' }).click()

    // The confirmation shows the monthly delta and the daily average…
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Monthly change')).toBeVisible()
    await expect(dialog.getByText('+¥30,000')).toBeVisible()
    await expect(dialog.getByText('Average daily change (30-day month)')).toBeVisible()
    await expect(dialog.getByText('+¥1,000')).toBeVisible()

    // …and the save only happens after the explicit confirm.
    await dialog.getByRole('button', { name: 'Save cap' }).click()
    await expect(dialog).toBeHidden()

    const put = mock.lastCapPut()
    expect(put?.body.amount).toEqual({ amount_minor: 80000, currency: 'JPY' })
    expect(put?.body.confirm_below_current_spend).toBeUndefined()
  })

  test('enabling auto-pause requires a typed confirmation naming the figure and no auto-resume', async ({
    page,
  }) => {
    mockAdvertisingBackend(page, {
      seedConnection: true,
      seedTwoCampaigns: true,
      seedCaps: true,
    })
    await page.goto('/advertising/budget')

    // The seeded tenant cap has auto-pause on; switch it off first (no
    // confirmation needed to *reduce* what the guardrail may do).
    const tenantCard = page.locator('.budget__cap', { hasText: 'All campaigns' })
    await tenantCard.getByRole('button', { name: 'Edit' }).click()
    await page.getByLabel('At 100% of the cap').selectOption('false')
    await page.getByRole('button', { name: 'Save cap' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()

    // Now enabling it is the typed-confirmation flow.
    await page.getByLabel('At 100% of the cap').selectOption('true')
    await page.getByRole('button', { name: 'Save cap' }).click()

    const dialog = page.getByRole('dialog')
    // The consequence copy states the pause figure, the affected scope,
    // that paused campaigns stop delivering immediately, and that there is
    // no auto-resume.
    await expect(dialog.getByText(/¥50,000/).first()).toBeVisible()
    await expect(dialog.getByText(/All campaigns \(this tenant\)/).first()).toBeVisible()
    await expect(dialog.getByText(/stop delivering on the platform immediately/)).toBeVisible()
    await expect(dialog.getByText(/do not resume by themselves/)).toBeVisible()

    // Typed confirmation: the pause figure itself.
    const confirm = dialog.getByRole('button', { name: 'Save cap' })
    await expect(confirm).toBeDisabled()
    await dialog.getByRole('textbox').fill('¥49,999')
    await expect(confirm).toBeDisabled()
    await dialog.getByRole('textbox').fill('¥50,000')
    await expect(confirm).toBeEnabled()
    await confirm.click()
    await expect(dialog).toBeHidden()
  })

  test('lowering a cap below current spend warns before applying — via the 409 round-trip', async ({
    page,
  }) => {
    const mock = mockAdvertisingBackend(page, {
      seedConnection: true,
      seedTwoCampaigns: true,
      seedCaps: true,
    })
    await page.goto('/advertising/budget')

    // 40,000 spent of the tenant monthly cap; 10,000 is far below it.
    const tenantCard = page.locator('.budget__cap', { hasText: 'All campaigns' })
    await tenantCard.getByRole('button', { name: 'Edit' }).click()
    await page.getByLabel('Cap amount (JPY)').fill('10000')
    await page.getByRole('button', { name: 'Save cap' }).click()

    const dialog = page.getByRole('dialog', { name: 'Cap below spend so far' })
    await expect(dialog.getByText(/can pause campaigns immediately/)).toBeVisible()
    await dialog.getByRole('button', { name: 'Save anyway' }).click()
    await expect(dialog).toBeHidden()

    expect(mock.lastCapPut()?.body.confirm_below_current_spend).toBe(true)
    expect(mock.lastCapPut()?.body.amount).toEqual({ amount_minor: 10000, currency: 'JPY' })
  })

  test('a cross-currency tenant cap cannot be saved without an explicit FX basis', async ({
    page,
  }) => {
    const mock = mockAdvertisingBackend(page, {
      seedTwoConnections: true,
      seedTwoCampaigns: true,
    })
    await page.goto('/advertising/budget')

    // Two accounts in JPY and USD: the form leaves the basis unselected.
    await page.getByLabel(/^Cap amount \(/).fill('50000')
    await expect(page.getByText(/Choose a cap currency before saving/)).toBeVisible()

    // The explicit choice unlocks the save and is what reaches the API.
    await page.getByLabel('Cap currency').selectOption('JPY')
    await expect(page.getByText(/Choose a cap currency before saving/)).toBeHidden()
    await page.getByRole('button', { name: 'Save cap' }).click()

    const put = mock.lastCapPut()
    expect(put?.body.declared_fx_basis).toBe('explicit:JPY')
    expect(put?.body.amount).toEqual({ amount_minor: 50000, currency: 'JPY' })
  })

  test('the live preview shows current spend, projection, and the breach date with freshness', async ({
    page,
  }) => {
    mockAdvertisingBackend(page, { seedConnection: true, seedTwoCampaigns: true })
    await page.goto('/advertising/budget')

    await page.getByLabel('Cap amount (JPY)').fill('45000')

    const preview = page.locator('.budget__preview')
    await expect(preview.getByText('¥40,000')).toBeVisible()
    await expect(preview.getByText('¥62,000')).toBeVisible()
    await expect(preview.getByText(/at the current rate/)).toBeVisible()
    // The projected-figure caveat is inline, not hidden.
    await expect(preview.getByText(/Projected figures are estimates/)).toBeVisible()
  })

  test('with stale ingestion data every spend figure is labelled stale', async ({ page }) => {
    const mock = mockAdvertisingBackend(page, {
      seedConnection: true,
      seedTwoCampaigns: true,
      seedCaps: true,
    })
    mock.stallConnection()
    await page.goto('/advertising/budget')

    await expect(page.getByText(/Stale —/).first()).toBeVisible()
    await expect(page.getByText(/ingestion has fallen behind/).first()).toBeVisible()
  })

  test('flag off renders the disabled state naming the reason', async ({ page }) => {
    mockAdvertisingBackend(page, {
      seedConnection: true,
      seedCaps: true,
      budgetGuardrailsDisabled: true,
    })
    await page.goto('/advertising/budget')

    await expect(page.getByText('Budget guardrails are not enabled yet')).toBeVisible()
    await expect(page.getByText(/Caps already in place keep guarding/)).toBeVisible()
  })
})

test.describe('budget alert history (TASK-017)', () => {
  test('each entry shows figure, freshness, and action; acknowledgement round-trips', async ({
    page,
  }) => {
    const mock = mockAdvertisingBackend(page, {
      seedConnection: true,
      seedTwoCampaigns: true,
      seedAlerts: true,
    })
    await page.goto('/advertising/budget/alerts')

    const table = page.getByRole('table', { name: 'Budget alert history, newest first' })
    await expect(table.getByText('80% of cap reached')).toBeVisible()
    await expect(table.getByText('Cap reached (settled figures)')).toBeVisible()
    // Figures carry the cap alongside the spend.
    await expect(table.getByText('¥40,000 / ¥50,000')).toBeVisible()
    // The stale entry says so — the data behind the figure, not just the figure.
    await expect(table.getByText(/Stale —/).first()).toBeVisible()
    // The action taken, as words.
    await expect(table.getByText('Notification only — nothing paused').first()).toBeVisible()

    // Acknowledge the first unacknowledged alert and see the round-trip:
    // the row re-renders from the API response, then the counter agrees.
    await table
      .getByRole('button', { name: /^Acknowledge/ })
      .first()
      .click()
    await expect(table.getByText(/Acknowledged/).first()).toBeVisible()
    expect(mock.acknowledgedCount()).toBe(1)
  })

  test('the unacknowledged filter narrows the history', async ({ page }) => {
    mockAdvertisingBackend(page, {
      seedConnection: true,
      seedTwoCampaigns: true,
      seedAlerts: true,
    })
    await page.goto('/advertising/budget/alerts')

    await page.getByRole('button', { name: 'Show unacknowledged only' }).click()
    const table = page.getByRole('table', { name: 'Budget alert history, newest first' })
    await expect(table.getByText('Warning while data is stale')).toHaveCount(0)
    await expect(table.getByText('80% of cap reached')).toBeVisible()

    await page.getByRole('button', { name: 'Show all' }).click()
    await expect(table.getByText('Warning while data is stale')).toBeVisible()
  })
})

test.describe('spend status on the dashboard (TASK-017)', () => {
  test('the dashboard renders cap progress alongside the KPIs with freshness inline', async ({
    page,
  }) => {
    mockAdvertisingBackend(page, {
      seedConnection: true,
      seedTwoCampaigns: true,
      seedCaps: true,
    })
    await page.goto('/advertising/dashboard')

    await expect(page.getByRole('heading', { name: 'Budget caps' })).toBeVisible()
    await expect(page.getByText('80% — approaching cap').first()).toBeVisible()
    await expect(page.getByText(/Spend figures last synced/).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Manage caps' })).toBeVisible()
  })

  test('with the guardrails flag off the dashboard hides the cap section', async ({ page }) => {
    mockAdvertisingBackend(page, {
      seedConnection: true,
      seedCaps: true,
      budgetGuardrailsDisabled: true,
    })
    await page.goto('/advertising/dashboard')

    await expect(page.getByRole('heading', { name: 'Budget caps' })).toHaveCount(0)
  })
})
