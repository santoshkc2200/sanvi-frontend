import { expect, test } from '@playwright/test'
import { mockDomainsBackend } from './mock-domains-backend'

/**
 * Purchase wizard, end to end against the mocked backend. `failed` and
 * `refunded` are two distinct real OrderStatus values with different
 * required copy (see docs/superpowers/plans/2026-08-30-phase-08-domains-
 * frontend-waves.md, Task 3.3's correction) — a `failed` order was never
 * charged, so it must not claim a refund; a `refunded` order was charged
 * then reversed. Both are exercised separately here rather than conflated.
 */
async function fillThroughToReview(page: import('@playwright/test').Page) {
  await page.goto('/domains/purchase')
  await page.getByPlaceholder('example.com or mystore').fill('freshstore')
  await page.getByRole('button', { name: 'Select' }).first().click()
  await page.getByRole('button', { name: 'Continue to options' }).click()

  await expect(
    page.getByRole('heading', { name: 'Step 2: Domain options', level: 2 }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Continue to registrant details' }).click()

  await expect(
    page.getByRole('heading', { name: 'Step 3: Registrant contact details', level: 2 }),
  ).toBeVisible()
  await page.getByPlaceholder('Jane Doe').fill('Jane Doe')
  await page.getByPlaceholder('owner@example.com').fill('jane@example.com')
  await page.getByPlaceholder('+1.5551234567 or +81-3-1234-5678').fill('+1.5559876543')
  await page.getByRole('button', { name: 'Continue to review & payment' }).click()

  await expect(
    page.getByRole('heading', { name: 'Step 4: Review and confirm order', level: 2 }),
  ).toBeVisible()
}

test.describe('domain purchase wizard', () => {
  test('happy path: search, configure, pay, and go live', async ({ page }) => {
    const state = mockDomainsBackend(page)
    state.searchResults = [
      {
        hostname: 'freshstore.com',
        tld: 'com',
        available: true,
        premium: false,
        register_price: { amount_minor: 1299, currency: 'USD' },
        renew_price: { amount_minor: 1499, currency: 'USD' },
        registrar_id: 'sandbox',
      },
    ]

    await fillThroughToReview(page)
    await page.getByRole('button', { name: 'Confirm & place order' }).click()

    await expect(
      page.getByRole('heading', { name: 'Step 5: Provisioning your domain', level: 2 }),
    ).toBeVisible()

    // Simulate the order sweep completing registration, then the same
    // verification/cert pipeline the connect wizard already covers taking
    // the resulting domain to live.
    state.orders[0]!.status = 'active'
    state.orders[0]!.registered_at = new Date().toISOString()
    state.domains = [
      {
        id: 'dom_purchased_1',
        hostname: 'freshstore.com',
        kind: 'purchased',
        role: 'primary',
        status: 'live',
        detected_registrar: null,
        challenge: null,
        failure: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    await expect(
      page.getByRole('heading', { name: 'Step 6: Your domain is live!', level: 2 }),
    ).toBeVisible({ timeout: 10000 })
  })

  test('order fails before any charge succeeds: no refund claim', async ({ page }) => {
    const state = mockDomainsBackend(page)
    state.searchResults = [
      {
        hostname: 'willfail.com',
        tld: 'com',
        available: true,
        premium: false,
        register_price: { amount_minor: 999, currency: 'USD' },
        renew_price: { amount_minor: 1299, currency: 'USD' },
        registrar_id: 'sandbox',
      },
    ]

    await fillThroughToReview(page)
    await page.getByRole('button', { name: 'Confirm & place order' }).click()
    await expect(
      page.getByRole('heading', { name: 'Step 5: Provisioning your domain', level: 2 }),
    ).toBeVisible()

    state.orders[0]!.status = 'failed'

    await expect(page.getByText('Domain registration failed')).toBeVisible({ timeout: 10000 })
    await expect(
      page.getByText(
        'The domain registration order could not be completed. Your payment method was not charged.',
      ),
    ).toBeVisible()
    await expect(page.getByText('A full refund has been issued')).not.toBeVisible()
  })

  test('order is charged then registration fails: refund is disclosed', async ({ page }) => {
    const state = mockDomainsBackend(page)
    state.searchResults = [
      {
        hostname: 'willrefund.com',
        tld: 'com',
        available: true,
        premium: false,
        register_price: { amount_minor: 1999, currency: 'USD' },
        renew_price: { amount_minor: 2299, currency: 'USD' },
        registrar_id: 'sandbox',
      },
    ]

    await fillThroughToReview(page)
    await page.getByRole('button', { name: 'Confirm & place order' }).click()
    await expect(
      page.getByRole('heading', { name: 'Step 5: Provisioning your domain', level: 2 }),
    ).toBeVisible()

    state.orders[0]!.status = 'refunded'

    await expect(page.getByText('Order failed and refunded')).toBeVisible({ timeout: 10000 })
    await expect(
      page.getByText(
        'Registration could not be completed with the registrar after payment. A full refund has been issued to your payment method.',
      ),
    ).toBeVisible()
  })
})
