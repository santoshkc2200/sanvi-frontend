import { expect, test } from '@playwright/test'
import { mockAdvertisingBackend } from './mock-advertising-backend'

/**
 * The TASK-011 connection journey, end to end against a mocked backend:
 * connect (simulated OAuth round-trip) → account picker (currency +
 * timezone) → healthy connection with a last-sync time → typed-confirm
 * disconnect → connection gone. Advertising e2e needs no live backend —
 * every route the console calls is answered in-process (see
 * mock-advertising-backend.ts), unlike the phase-09 specs that waited for
 * one.
 */

test.describe('Advertising connections (10.2)', () => {
  test.beforeEach(async ({ page }) => {
    mockAdvertisingBackend(page)
  })

  test('connect via the OAuth round-trip, pick the account, land healthy', async ({ page }) => {
    await page.goto('/advertising/connections')

    // Pre-connect: the explainer and the fresh-connect CTA on the card.
    await expect(page.getByRole('heading', { name: 'Meta Ads' })).toBeVisible()
    const card = page.locator('article[data-platform-key="meta"]')
    await expect(card.getByText('Not connected')).toBeVisible()
    await card.getByRole('button', { name: 'Connect', exact: true }).click()

    // The handoff redirects through the platform (simulated in-app) and
    // returns to the callback route, which lands on the picker.
    await expect(page.getByRole('heading', { name: 'Choose your ad account' })).toBeVisible({
      timeout: 10_000,
    })

    // Two eligible ad accounts from the (simulated) manager account.
    await page.getByRole('radio', { name: /Acme Main Ad Account/ }).check()
    await expect(page.getByText('Ad accounts').first()).toBeVisible()
    await page.getByLabel(/Account currency \(Acme Main Ad Account\)/).fill('jpy')
    await page.getByLabel(/Account timezone \(Acme Main Ad Account\)/).fill('Asia/Tokyo')
    await page.getByRole('button', { name: 'Connect this account' }).click()

    // Back on the connections screen: healthy, with the declared currency,
    // timezone, and a last-sync time.
    await expect(page.getByRole('heading', { name: 'Advertising connections' })).toBeVisible()
    await expect(card.getByText('Connected', { exact: true })).toBeVisible()
    await expect(card.getByText(/Healthy/)).toBeVisible()
    await expect(card.getByText(/Last synced/)).toBeVisible()
    await expect(page.getByText(/Acme Main Ad Account · JPY · Asia\/Tokyo/)).toBeVisible()
  })

  test('disconnect requires the typed confirmation and removes the connection', async ({
    page,
  }) => {
    // Seed a live connection through the real UI flow (the previous spec's
    // journey, compacted) so disconnect removes something real.
    await page.goto('/advertising/connections')
    const card = page.locator('article[data-platform-key="meta"]')
    await card.getByRole('button', { name: 'Connect', exact: true }).click()
    await page.getByRole('radio', { name: /Acme Main Ad Account/ }).check()
    await page.getByLabel(/Account currency/).fill('JPY')
    await page.getByLabel(/Account timezone/).fill('Asia/Tokyo')
    await page.getByRole('button', { name: 'Connect this account' }).click()
    await expect(card.getByText('Connected', { exact: true })).toBeVisible()

    // Open the disconnect dialog: consequences above the fold.
    await page.getByRole('button', { name: 'Disconnect', exact: true }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(
      page
        .getByRole('dialog')
        .getByText('Your campaigns keep running on the platform and keep spending.'),
    ).toBeVisible()

    // Confirm stays locked until the exact phrase.
    const confirm = page.getByRole('button', { name: 'Disconnect account' })
    await expect(confirm).toBeDisabled()
    await page.getByLabel(/Type DISCONNECT/).fill('DISCONNECT')
    await confirm.click()

    // The connection is gone — the card reads not connected again.
    await expect(page.getByRole('heading', { name: 'Advertising connections' })).toBeVisible()
    await expect(card.getByText('Not connected')).toBeVisible()
    await expect(card.getByText('Connected', { exact: true })).toHaveCount(0)
  })

  test('the full flow is keyboard operable: connect, pick, and confirm by keyboard alone', async ({
    page,
  }) => {
    await page.goto('/advertising/connections')
    const card = page.locator('article[data-platform-key="meta"]')

    await card.getByRole('button', { name: 'Connect', exact: true }).focus()
    await page.keyboard.press('Enter')

    await page.getByRole('heading', { name: 'Choose your ad account' }).waitFor()
    await page.getByRole('radio', { name: /Acme EU Ad Account/ }).focus()
    await page.keyboard.press('Space')
    await page.getByLabel(/Account currency/).fill('EUR')
    await page.getByLabel(/Account timezone/).fill('Europe/Berlin')
    await page.getByRole('button', { name: 'Connect this account' }).focus()
    await page.keyboard.press('Enter')

    await expect(page.getByText(/Acme EU Ad Account · EUR · Europe\/Berlin/)).toBeVisible()
  })
})
