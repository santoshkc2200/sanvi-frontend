import { expect, test } from '@playwright/test'

/**
 * TASK-025 steps 2+3: the public status page in both locales. The preview
 * server boots with no backend behind it (`PUBLIC_API_ORIGIN` answers
 * nothing), so the default state here is the honest one: the page renders
 * its last-known `unknown` state with the hosting limitation, rather than
 * crashing. Fulfilling the readiness probe flips it live.
 */
test.describe('status page', () => {
  test('status page renders the unknown state with the API down rather than a crash', async ({
    page,
  }) => {
    const response = await page.goto('/status')
    expect(response?.ok()).toBe(true)
    await expect(page.getByRole('heading', { name: 'System status' })).toBeVisible()
    await expect(page.locator('[data-status="unknown"]')).toBeVisible()
    // Incident history renders (empty, honestly labelled)…
    await expect(page.getByText('No incidents recorded.')).toBeVisible()
    // …and the limitation is documented on the page itself.
    await expect(page.getByText(/same infrastructure it reports on/)).toBeVisible()
  })

  test('status page shows the degraded state from the readiness signal, then recovers', async ({
    page,
  }) => {
    await page.route('**/api/v1/system/ready', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'degraded',
          checks: [
            { name: 'database', state: 'ok' },
            { name: 'redis', state: 'degraded' },
          ],
        }),
      }),
    )
    await page.goto('/status')
    await expect(page.locator('[data-status="degraded"]')).toBeVisible()
    await expect(page.getByText(/Affected: redis/)).toBeVisible()
    // No hostname, version, or error string leaks onto the surface — the
    // states-only signal carries names alone. (`localhost:8080` legitimately
    // appears in the baked CSP meta, so scope the check to the state copy.)
    const stateText = await page.locator('[data-status="degraded"]').innerText()
    expect(stateText).not.toMatch(/Traceback|internal server|error:|v?\d+\.\d+\.\d+/i)

    await page.unroute('**/api/v1/system/ready')
    await page.route('**/api/v1/system/ready', (route) =>
      route.fulfill({
        json: { status: 'ok', checks: [{ name: 'database', state: 'ok' }] },
      }),
    )
    await page.getByRole('button', { name: 'Refresh status' }).click()
    await expect(page.locator('[data-status="operational"]')).toBeVisible()
  })

  test('status page renders in Japanese', async ({ page }) => {
    const response = await page.goto('/ja/status')
    expect(response?.ok()).toBe(true)
    await expect(page.getByRole('heading', { name: 'システムステータス' })).toBeVisible()
    await expect(page.getByText(/同じインフラ/)).toBeVisible()
  })

  test('marketing footer links to the status page', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Status' })).toHaveAttribute('href', '/status')
  })
})
