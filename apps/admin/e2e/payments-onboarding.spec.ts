import { expect, test } from '@playwright/test'

test.describe('Payments onboarding (09.2)', () => {
  test.beforeEach(async ({ page }) => {
    // Minimal backend for payments onboarding E2E
    const me = {
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
          permissions: [
            'payments.read',
            'payments.manage',
            'payments.checkout',
            'tenancy.settings.read',
          ],
        },
      ],
    }
    const context = {
      tenant_id: 'dev-acme',
      slug: 'acme',
      display_name: 'Acme',
      status: 'active',
      region: 'us',
      default_locale: 'en',
      resolution_source: 'internal_header',
    }

    await page.route('**/api/v1/me', (r) => r.fulfill({ json: me }))
    await page.route('**/api/v1/me/sessions', (r) => r.fulfill({ json: [] }))
    await page.route('**/api/v1/tenant/context', (r) => r.fulfill({ json: context }))
    await page.route('**/api/v1/tenant/settings', (r) => r.fulfill({ json: { settings: {} } }))
    await page.route('**/api/v1/tenant/entitlements', (r) =>
      r.fulfill({ json: [{ feature: 'payments.stripe_connect', enabled: true }] }),
    )
    await page.route('**/api/v1/tenant/payments/providers', (r) =>
      r.fulfill({
        json: {
          providers: [
            {
              kind: 'stripe_connect',
              display_name: 'Stripe',
              available: true,
              requires_onboarding: true,
              supported_countries: ['US', 'JP'],
            },
          ],
        },
      }),
    )
    const connectionId = 'conn_e2e_123'
    await page.route('**/api/v1/tenant/payments/connections', async (r) => {
      if (r.request().method() === 'POST') {
        await r.fulfill({
          status: 201,
          json: {
            id: connectionId,
            provider: 'stripe_connect',
            status: 'pending',
            capabilities: {},
            requirements: { currently_due: [], eventually_due: [], past_due: [], deadline: null },
            blockers: [],
            country: 'US',
            default_currency: 'USD',
            connected_at: null,
            last_synced_at: null,
            can_accept_payments: false,
          },
        })
      } else {
        await r.continue()
      }
    })
    await page.route('**/api/v1/tenant/payments/connections/*/session', async (r) => {
      await r.fulfill({
        status: 201,
        json: {
          client_secret: `secret_e2e_${Date.now()}`,
          components: ['account_onboarding'],
          connection_id: connectionId,
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          provider: 'stripe_connect',
        },
      })
    })
    // Stripe Connect.js loader: mock the CDN script to avoid external network and to
    // correctly surface fetchClientSecret failures via setOnLoadError.
    await page.route('https://connect-js.stripe.com/**', (r) =>
      r.fulfill({
        body: `
          class StripeConnectAccountOnboarding extends HTMLElement {
            setConnector(connector) {}
            setOnExitInternalOnly(cb) { this._onExit = cb; }
            setOnLoaderStartInternalOnly(cb) { this._onLoaderStart = cb; }
            setOnLoadErrorInternalOnly(cb) { this._onLoadError = cb; }
          }
          if (!customElements.get('stripe-connect-account-onboarding')) {
            customElements.define('stripe-connect-account-onboarding', StripeConnectAccountOnboarding);
          }

          window.StripeConnect = window.StripeConnect || {};
          window.StripeConnect.init = function(opts) {
            var secretPromise = (opts.metaOptions && opts.metaOptions.eagerClientSecretPromise) ||
              (typeof opts.fetchClientSecret === 'function' ? opts.fetchClientSecret() : Promise.resolve('mock_secret'));

            secretPromise.then(function() {
              setTimeout(function() {
                var els = document.querySelectorAll('stripe-connect-account-onboarding');
                els.forEach(function(el) {
                  if (el._onLoaderStart) el._onLoaderStart({ elementTagName: 'account-onboarding' });
                });
              }, 10);
            }).catch(function(err) {
              setTimeout(function() {
                var els = document.querySelectorAll('stripe-connect-account-onboarding');
                els.forEach(function(el) {
                  if (el._onLoadError) {
                    el._onLoadError({ error: { type: 'account_session_create_error', message: err.message || String(err) } });
                  }
                });
              }, 10);
            });

            return {
              connect: function() {},
              logout: function() {},
              update: function() {},
            };
          };
        `,
        contentType: 'application/javascript',
      }),
    )
    await page.route('https://js.stripe.com/**', (r) =>
      r.fulfill({ body: '', contentType: 'application/javascript' }),
    )
  })

  test('connect → embedded onboarding renders → close tab → return resumes without start over', async ({
    page,
  }) => {
    await page.goto('/payments')
    await expect(page.getByRole('heading', { name: 'Payments' })).toBeVisible()
    await expect(page.getByText('What Stripe will ask for')).toBeVisible()
    await page.getByRole('button', { name: 'Connect' }).click()
    await expect(page.getByText('Complete your Stripe setup')).toBeVisible()
    await expect(page.locator('stripe-connect-account-onboarding')).toBeAttached()
    // Resumability: reload the page (localStorage persists the connection id)
    await page.reload()
    await expect(page.getByText('Complete your Stripe setup')).toBeVisible()
    await expect(page.getByText('What Stripe will ask for')).toBeVisible()
    await expect(page.locator('stripe-connect-account-onboarding')).toBeAttached()
  })

  test('session fetch failure shows retry, not blank iframe', async ({ page }) => {
    await page.unroute('**/api/v1/tenant/payments/connections/*/session')
    await page.route('**/api/v1/tenant/payments/connections/*/session', (r) =>
      r.fulfill({
        status: 400,
        json: { title: 'Provider unavailable', type: 'payments/provider-unavailable' },
      }),
    )
    await page.goto('/payments')
    await page.getByRole('button', { name: 'Connect' }).click()
    await expect(page.getByText('Complete your Stripe setup')).toBeVisible()
    await expect(page.getByText('Could not start onboarding')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
  })

  test('renders under production CSP (no unsafe-inline relaxation)', async ({ page }) => {
    await page.goto('/payments')
    const csp = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute('content')
    expect(csp).toBeTruthy()

    const directives = Object.fromEntries(
      (csp ?? '')
        .split(';')
        .map((d) => d.trim())
        .filter(Boolean)
        .map((d) => {
          const [name, ...values] = d.split(/\s+/)
          return [name, values.join(' ')]
        }),
    )

    // Production CSP must not contain unsafe-inline or unsafe-eval in script-src
    expect(directives['script-src']).toBeDefined()
    expect(directives['script-src']).not.toContain("'unsafe-inline'")
    expect(directives['script-src']).not.toContain("'unsafe-eval'")
    expect(directives['script-src']).toContain('https://js.stripe.com')
    expect(directives['script-src']).toContain('https://*.stripe.com')

    // frame-src must allow Stripe iframe embedding for Connect.js
    expect(directives['frame-src']).toBeDefined()
    expect(directives['frame-src']).toContain('https://js.stripe.com')
    expect(directives['frame-src']).toContain('https://*.stripe.com')

    // connect-src must allow Stripe API calls
    expect(directives['connect-src']).toBeDefined()
    expect(directives['connect-src']).toContain('https://api.stripe.com')
    expect(directives['connect-src']).toContain('https://*.stripe.com')
  })
})
