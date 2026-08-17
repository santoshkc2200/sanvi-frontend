import { expect, test } from '@playwright/test'

/**
 * Absolute URLs (not `baseURL` + a relative path) — each test needs a
 * different *host*, and `*.localhost` resolves to loopback without any
 * `/etc/hosts` entry (RFC 6761). The port must match `webServer`'s
 * (4174) and `e2e/fixtures/mock-api-server.mjs`'s `TENANTS` keys.
 */
const PORT = 4174

test.describe('tenant resolution', () => {
  test('a known active tenant renders on first paint (SSR, not a client-side fetch)', async ({
    page,
  }) => {
    const response = await page.goto(`http://acme.localhost:${PORT}/`)
    expect(response?.ok()).toBe(true)
    await expect(page).toHaveTitle('Acme Corporation')
    await expect(page.getByText('Acme Corporation')).toBeVisible()
  })

  test('an unknown host 404s with no host/tenant enumeration in the page', async ({ page }) => {
    // Errors thrown from the *root* `+layout.server.ts` skip `+error.svelte`
    // entirely — SvelteKit renders `src/error.html` instead, since there's
    // no parent layout left to render a Svelte error boundary inside.
    const response = await page.goto(`http://ghost.localhost:${PORT}/`)
    expect(response?.status()).toBe(404)
    await expect(page.getByRole('heading', { name: '404' })).toBeVisible()
    await expect(page.getByText('ghost', { exact: false })).toHaveCount(0)
  })

  test('a suspended tenant renders the maintenance notice instead of its content', async ({
    page,
  }) => {
    const response = await page.goto(`http://suspended.localhost:${PORT}/`)
    expect(response?.ok()).toBe(true)
    await expect(page.getByText(/suspended/i)).toBeVisible()
    await expect(page.getByText('Suspended Co')).toHaveCount(0) // maintenance branch, not the tenant's own content
  })
})
