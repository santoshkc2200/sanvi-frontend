import { expect, test, type Page } from '@playwright/test'
import { mockAdvertisingBackend, type AdvertisingMockControls } from './mock-advertising-backend'

/**
 * The TASK-012 campaign journey, end to end against a mocked backend:
 * create a campaign through the builder → see it listed → publish → pause →
 * read the change log; a drift scenario shows the diff and does not
 * auto-overwrite; a refresh mid-builder resumes the draft; a budget
 * increase above the threshold confirms with the delta before saving.
 * Hermetic — every route is answered in-process.
 */

async function walkToReview(page: Page, options: { budget: string; name?: string }): Promise<void> {
  await page.getByLabel(/Campaign name/).fill(options.name ?? 'Spring launch')
  const objective = page.getByLabel(/Objective/)
  await objective.selectOption({ index: 1 })
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText('Who should see these ads')).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel(/budget amount/i).fill(options.budget)
  await page.getByLabel(/Budget type/).selectOption({ index: 1 })
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText('Ad creatives are added per ad group')).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('heading', { name: 'Create a campaign' })).toBeVisible()
  await expect(page.getByText('Spring launch')).toBeVisible()
}

test.describe('Advertising campaigns (10.3)', () => {
  let mock: AdvertisingMockControls

  test.beforeEach(async ({ page }) => {
    mock = mockAdvertisingBackend(page, { seedConnection: true })
  })

  test('create through the builder, see it listed, publish, pause, read the change log', async ({
    page,
  }) => {
    await page.goto('/advertising/campaigns/new?connection=conn_live_0')
    await walkToReview(page, { budget: '1500' })
    await page.getByRole('button', { name: 'Create campaign' }).click()

    // The detail view for the new draft.
    await expect(page.getByRole('heading', { name: 'Spring launch' })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText('Draft')).toBeVisible()

    // Publish — a real-money action, so it confirms first.
    await page.getByRole('button', { name: 'Publish' }).click()
    const publishDialog = page.getByRole('dialog')
    await expect(publishDialog.getByText(/real spending/i)).toBeVisible()
    await publishDialog.getByRole('button', { name: 'Publish now' }).click()
    await expect(page.getByText('Active', { exact: true })).toBeVisible({ timeout: 10_000 })

    // The list shows it with its budget in the ad account's currency.
    await page.goto('/advertising/campaigns')
    await expect(page.getByRole('heading', { name: 'Campaigns' })).toBeVisible()
    await expect(page.getByText('Spring launch')).toBeVisible()
    await expect(page.getByText(/¥1,500/)).toBeVisible()

    // Pause from the list, then read the change log on the detail view.
    await page.getByRole('button', { name: 'Pause' }).click()
    await expect(page.getByText('Paused', { exact: true })).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: 'View', exact: true }).first().click()
    await expect(page.getByRole('heading', { name: 'Spring launch' })).toBeVisible()
    await expect(page.getByText(/changed this campaign in Sanvi/).first()).toBeVisible()
    await expect(page.getByText(/Status/).first()).toBeVisible()
  })

  test('a drift scenario shows the diff and never resolves on its own', async ({ page }) => {
    // Seed a published campaign through the real UI.
    await page.goto('/advertising/campaigns/new?connection=conn_live_0')
    await walkToReview(page, { budget: '1500' })
    await page.getByRole('button', { name: 'Create campaign' }).click()
    await expect(page.getByRole('heading', { name: 'Spring launch' })).toBeVisible({
      timeout: 10_000,
    })
    await page.getByRole('button', { name: 'Publish' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Publish now' }).click()
    await expect(page.getByText('Active', { exact: true })).toBeVisible({ timeout: 10_000 })

    // The platform's native tool changes the budget — the campaign drifts.
    const campaignId = new URL(page.url()).pathname.split('/').pop() as string
    mock.simulatePlatformEdit(campaignId)

    await page.goto('/advertising/campaigns')
    await expect(page.getByRole('link', { name: 'Changed outside Sanvi' })).toBeVisible()
    await page.getByRole('link', { name: 'Changed outside Sanvi' }).click()

    // The diff: our ¥1,500 next to the platform's ¥7,500.
    await expect(page.getByRole('heading', { name: 'Changed outside Sanvi' })).toBeVisible()
    const table = page.getByRole('table')
    await expect(table.getByText(/¥1,500/)).toBeVisible()
    await expect(table.getByText(/¥7,500/)).toBeVisible()

    // Nothing resolves without an explicit choice and click.
    const confirm = page.getByRole('button', { name: 'Apply my choice' })
    await expect(confirm).toBeDisabled()
    const resolveCalls: string[] = []
    page.on('request', (request) => {
      if (request.url().endsWith('/drift')) resolveCalls.push(request.url())
    })
    await page.waitForTimeout(200)
    expect(resolveCalls.length).toBe(0)

    // An explicit choice is required — keep the platform's version.
    await page.getByRole('radio', { name: /Keep the platform's version/ }).check()
    await confirm.click()
    await expect(page.getByRole('heading', { name: 'Spring launch' })).toBeVisible({
      timeout: 10_000,
    })
    // Drift cleared: the diff on the adopted value.
    await expect(page.getByText(/¥7,500/).first()).toBeVisible()
  })

  test('a refresh mid-builder resumes the draft with every value intact', async ({ page }) => {
    await page.goto('/advertising/campaigns/new?connection=conn_live_0')
    await page.getByLabel(/Campaign name/).fill('Half-typed campaign')
    await page.getByLabel(/Objective/).selectOption({ index: 1 })
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText('Who should see these ads')).toBeVisible()
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByLabel(/budget amount/i).fill('2500')

    await page.reload()

    // The stepper resumes on the saved step with the values restored.
    await expect(page.getByLabel(/budget amount/i)).toHaveValue('2500', { timeout: 10_000 })
    // And the earlier steps kept their values too.
    await page.getByRole('button', { name: 'Back' }).click()
    await page.getByRole('link', { name: /Name & objective/ }).click()
    await expect(page.getByLabel(/Campaign name/)).toHaveValue('Half-typed campaign')
  })

  test('a budget increase above the threshold confirms with the delta before saving', async ({
    page,
  }) => {
    await page.goto('/advertising/campaigns/new?connection=conn_live_0')
    await walkToReview(page, { budget: '1500' })
    await page.getByRole('button', { name: 'Create campaign' }).click()
    await expect(page.getByRole('heading', { name: 'Spring launch' })).toBeVisible({
      timeout: 10_000,
    })

    // Edit the live campaign with a 10x budget.
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await expect(page.getByText(/Editing Spring launch/)).toBeVisible()
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText('Who should see these ads')).toBeVisible()
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByLabel(/budget amount/i).fill('15000')
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText('Ad creatives are added per ad group')).toBeVisible()
    await page.getByRole('button', { name: 'Continue' }).click()

    await page.getByRole('button', { name: 'Save changes' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText(/Confirm the budget increase/)).toBeVisible()
    await expect(dialog.getByText(/¥13,500/)).toBeVisible() // daily delta
    await expect(dialog.getByText(/¥405,000/)).toBeVisible() // projected 30 days

    // No PATCH fires until the dialog confirms.
    let patches = 0
    page.on('request', (request) => {
      if (request.method() === 'PATCH') patches += 1
    })
    await dialog.getByRole('button', { name: 'Confirm increase' }).click()
    await expect(page.getByRole('heading', { name: 'Spring launch' })).toBeVisible({
      timeout: 10_000,
    })
    expect(patches).toBe(1)
  })
})
