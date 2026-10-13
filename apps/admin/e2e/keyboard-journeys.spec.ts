import { expect, test, type Page } from '@playwright/test'
import { mockBackend } from './mock-backend'
import { mockDomainsBackend } from './mock-domains-backend'

/**
 * Keyboard-only critical journeys (TASK-027 step 8): connect a domain and
 * change a plan in the console without a mouse. Campaign publish's
 * keyboard coverage already lives in `advertising-journey.spec.ts` — this
 * file completes the console's journeys the matrix names. Activations are
 * keyboard activations (focus + Enter); typing is typing.
 */

async function activate(page: Page, role: 'button' | 'link', name: string | RegExp): Promise<void> {
  const target = page.getByRole(role, { name })
  await target.focus()
  await page.keyboard.press('Enter')
}

test.describe('keyboard-only console journeys (11.8)', () => {
  test.beforeEach(async ({ page }) => {
    mockBackend(page)
  })

  test('the skip link moves keyboard focus into the main region', async ({ page }) => {
    await page.goto('/billing')
    // The console boots asynchronously — the first Tab must happen once the
    // shell exists, or the keystrokes land in a document with no tabbables.
    await page.locator('.sanvi-app-shell__skip-link').waitFor({ state: 'visible' })

    // Tab until the skip link receives focus (it is the page's first
    // tabbable element); activating it moves focus — not just scroll —
    // into the main content region.
    let skipFocused = false
    for (let tabs = 0; tabs < 5 && !skipFocused; tabs += 1) {
      await page.keyboard.press('Tab')
      skipFocused = await page.evaluate(() =>
        document.activeElement?.classList.contains('sanvi-app-shell__skip-link'),
      )
    }
    expect(skipFocused).toBe(true)
    await page.keyboard.press('Enter')

    const mainIsFocus = await page.evaluate(() => {
      const main = document.getElementById('main-content')
      return document.activeElement === main
    })
    expect(mainIsFocus).toBe(true)
  })

  test('connects a domain end to end with the keyboard only', async ({ page }) => {
    const state = mockDomainsBackend(page)

    await page.goto('/domains/connect')
    await expect(
      page.getByRole('heading', { name: 'Step 1: Enter your domain', level: 2 }),
    ).toBeVisible()

    // Typing is keyboard: fill the hostname, then walk the wizard with
    // keyboard activations — no mouse anywhere.
    await page.getByPlaceholder('example.com or shop.example.com').fill('shop.example.com')
    await activate(page, 'button', 'Continue to DNS setup')

    await expect(
      page.getByRole('heading', { name: 'Step 2: Add DNS records at your registrar', level: 2 }),
    ).toBeVisible()
    await activate(page, 'button', "I've added these records")

    // The mock's verification job "completes": flip the domain live and let
    // the wizard's poll find it — still with no further input at all.
    state.domains[0]!.status = 'live'
    state.domains[0]!.verified_at = new Date().toISOString()

    await expect(
      page.getByRole('heading', { name: 'Step 5: Your domain is live!', level: 2 }),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('changes a plan with the keyboard only', async ({ page }) => {
    // The shared mock's memberships lack billing permissions; the /billing
    // route sits behind `billing.subscription.read` — last route wins.
    page.route('**/api/v1/me', (route) =>
      route.fulfill({
        json: {
          user_id: '0190f0d0-0000-7000-8000-000000000001',
          email: 'admin@example.com',
          email_verified: true,
          status: 'active',
          created_at: '2026-01-01T00:00:00Z',
          memberships: [
            {
              tenant_id: 'dev-acme',
              tenant_slug: 'acme',
              tenant_name: 'Acme Corporation',
              role_ids: ['owner'],
              status: 'active',
              permissions: ['billing.subscription.read'],
            },
          ],
        },
      }),
    )
    // A second plan to switch to; the current plan's box shows a disabled
    // "Current plan" button, the other one offers the select CTA.
    page.route('**/api/v1/public/plans', (route) =>
      route.fulfill({
        json: [
          {
            plan_id: '0190f0d0-0000-7000-8000-000000000011',
            key: 'starter',
            name: 'Starter',
            tier: 'starter',
            sort_order: 1,
            prices: [
              {
                price_id: '0190f0d0-0000-7000-8000-000000000021',
                currency: 'USD',
                interval: 'month',
                unit_amount_minor: 2900,
                trial_days: 14,
              },
            ],
            entitlements: [],
          },
          {
            plan_id: '0190f0d0-0000-7000-8000-000000000012',
            key: 'growth',
            name: 'Growth',
            tier: 'growth',
            sort_order: 2,
            prices: [
              {
                price_id: '0190f0d0-0000-7000-8000-000000000022',
                currency: 'USD',
                interval: 'month',
                unit_amount_minor: 9900,
                trial_days: 0,
              },
            ],
            entitlements: [],
          },
        ],
      }),
    )
    // The plan change itself completes in the hosted portal — the console's
    // keyboard-completable leg is creating that session and handing off,
    // which the interception captures.
    let portalHandedOff = false
    page.route('**/api/v1/tenant/billing/portal-session', async (route) => {
      portalHandedOff = true
      await route.fulfill({
        json: { url: 'https://billing.stripe.com/p/session_e2e_keyboard' },
      })
    })
    page.route('https://billing.stripe.com/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<html><title>Stripe</title></html>' }),
    )

    await page.goto('/billing')

    // The change-plan surface is the billing "Change plan" tab — a link, so
    // the keyboard reaches it through the same Tab order.
    await activate(page, 'link', 'Change Plan')
    await expect(page.getByRole('heading', { name: 'Growth' })).toBeVisible()

    await activate(page, 'button', 'Change to this plan')

    await expect.poll(() => portalHandedOff, { timeout: 10_000 }).toBe(true)
    await expect(page).toHaveURL(/billing\.stripe\.com/)
  })
})
