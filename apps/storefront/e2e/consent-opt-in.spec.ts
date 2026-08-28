import { expect, test } from '@playwright/test'
import { setPrivacyContext } from './fixtures/privacy-context'

/**
 * Opt-in (EU) consent journeys. The decisive assertions are network-level:
 * the mock API's request log proves the gated analytics script is fetched
 * only after a choice allows it — a UI state assertion can't prove that.
 */

async function fetchLog(
  page: import('@playwright/test').Page,
): Promise<{ method: string; path: string }[]> {
  // `page.request`, not in-page fetch: the mock is cross-origin from the
  // preview server, so the browser would block the response as CORS.
  const response = await page.request.get('http://localhost:8090/__privacy/log')
  return response.json()
}

async function clearLog(page: import('@playwright/test').Page): Promise<void> {
  await page.request.post('http://localhost:8090/__privacy/log/clear')
}

void clearLog

test.describe('opt-in consent', () => {
  test('nothing non-essential loads before a choice, and reject-all keeps it that way', async ({
    page,
  }) => {
    await setPrivacyContext(page)
    // Network-level proof: watch the browser's own requests — the gated
    // script is served by the storefront origin, so only a request listener
    // can prove it was (or was never) fetched.
    const scriptRequests: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('mock-analytics.js')) scriptRequests.push(request.url())
    })

    await page.goto('/')
    const banner = page.getByRole('dialog', { name: /ask before we track/i })
    await expect(banner).toBeVisible()

    // Reject and Accept have identical visual weight (same classes).
    const reject = banner.getByRole('button', { name: 'Reject all' })
    const accept = banner.getByRole('button', { name: 'Accept all' })
    expect(await reject.getAttribute('class')).toBe(await accept.getAttribute('class'))

    await reject.click()
    await expect(banner).toBeHidden()

    // Reload: the refusal persists — no banner again, and no analytics script.
    await page.reload()
    await expect(page.getByRole('dialog', { name: /ask before we track/i })).toBeHidden()
    expect(scriptRequests).toEqual([])
  })

  test('accept-all loads the gated script, and the choice survives a reload', async ({ page }) => {
    await setPrivacyContext(page)
    await page.goto('/')

    const banner = page.getByRole('dialog', { name: /ask before we track/i })
    await acceptAll(page)

    await expect(banner).toBeHidden()
    // No queue: the load attempt made before consent was refused, and the
    // gate does not retroactively fire it — the script arrives on the next
    // page init, when the store hydrates with the granted decision.
    const scriptRequested = page.waitForEvent('request', {
      predicate: (request) => request.url().includes('mock-analytics.js'),
    })
    await page.reload()
    await scriptRequested
    await expect(page.getByRole('dialog', { name: /ask before we track/i })).toBeHidden()

    // The preference centre reflects the grant per purpose.
    await page.goto('/privacy/choices')
    await expect(page.getByRole('checkbox', { name: /Product analytics/ })).toBeChecked()
    await expect(page.getByRole('checkbox', { name: /Sale or sharing/ })).toBeChecked()
  })

  test('choose navigates to the preference centre and a refusal there holds', async ({ page }) => {
    await setPrivacyContext(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'Choose purposes' }).click()
    await expect(page).toHaveURL(/\/privacy\/choices/)

    const analytics = page.getByRole('checkbox', { name: /Product analytics/ })
    await analytics.uncheck()
    await expect(analytics).not.toBeChecked()

    // The refusal was recorded server-side, not just locally.
    const log = await fetchLog(page)
    expect(
      log.some((entry) => entry.path === '/api/v1/privacy/consents' && entry.method === 'PUT'),
    ).toBe(true)

    // The refusal itself persists across a reload.
    await page.reload()
    await expect(page.getByRole('checkbox', { name: /Product analytics/ })).not.toBeChecked()
  })
})

async function acceptAll(page: import('@playwright/test').Page): Promise<void> {
  const banner = page.getByRole('dialog', { name: /ask before we track/i })
  await expect(banner).toBeVisible()
  await banner.getByRole('button', { name: 'Accept all' }).click()
}
