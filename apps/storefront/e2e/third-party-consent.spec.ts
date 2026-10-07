import { expect, test, type Page, type Request } from '@playwright/test'
import { setPrivacyContext } from './fixtures/privacy-context'

/**
 * TASK-022 step 6 — the third-party audit, proven per consent mode.
 *
 * One e2e per mode (EU opt-in, US notice-and-opt-out) asserts **zero
 * third-party requests before a permitting directive exists**. "Third-party"
 * here is every origin outside the harness's two first-party origins: the
 * storefront preview (:4174) and its mock API (:8090). The storefront's only
 * gated script and its conversion beacon are same-origin by design, so a
 * request to any other origin before consent is a privacy bug and a
 * performance bug at once — a script that only loads correctly in one
 * consent mode is both.
 *
 * The assertion is network-level (the page's own request stream), the same
 * proof style the consent suite uses: a UI state can't prove what was
 * fetched.
 */

const FIRST_PARTY_PORTS = new Set(['4174', '8090'])

function trackThirdParty(page: Page): string[] {
  const thirdParty: string[] = []
  page.on('request', (request: Request) => {
    const url = new URL(request.url())
    if (!FIRST_PARTY_PORTS.has(url.port)) {
      thirdParty.push(request.url())
    }
  })
  return thirdParty
}

/** Long enough for every eager loader, preload, and beacon to have fired. */
const SETTLE_MS = 1500

test.describe('third-party requests vs consent (TASK-022)', () => {
  test('EU opt-in: none before a choice, none after a grant either', async ({ page }) => {
    await setPrivacyContext(page, { jurisdiction: 'eu' })
    const thirdParty = trackThirdParty(page)

    await page.goto('/')
    const banner = page.getByRole('dialog', { name: /ask before we track/i })
    await expect(banner).toBeVisible()
    await page.waitForTimeout(SETTLE_MS)
    expect(thirdParty).toEqual([])

    // After a permissive choice the storefront still talks to nobody new:
    // its analytics gate and beacon are same-origin by design. This is the
    // "loads correctly in one consent mode" trap — the grant must not be
    // where a third-party script suddenly appears.
    await banner.getByRole('button', { name: 'Accept all' }).click()
    await expect(banner).toBeHidden()
    await page.waitForTimeout(SETTLE_MS)
    expect(thirdParty).toEqual([])
  })

  test('US notice-and-opt-out: none before the notice is acknowledged, none after', async ({
    page,
  }) => {
    await setPrivacyContext(page, { jurisdiction: 'us-ca' })
    const thirdParty = trackThirdParty(page)

    await page.goto('/')
    const notice = page.getByRole('heading', { name: 'Notice at collection' })
    await expect(notice).toBeVisible()
    await page.waitForTimeout(SETTLE_MS)
    expect(thirdParty).toEqual([])

    await page.getByRole('button', { name: 'Got it' }).click()
    await expect(notice).toBeHidden()
    await page.waitForTimeout(SETTLE_MS)
    expect(thirdParty).toEqual([])
  })

  test('the ja pages — fonts, preloads and all — stay first-party before consent', async ({
    page,
  }) => {
    await setPrivacyContext(page, { jurisdiction: 'eu' })
    const thirdParty = trackThirdParty(page)

    // /ja/ is the heaviest static surface (preloaded CJK font subsets);
    // its subsetting is self-hosted precisely so this holds.
    await page.goto('/ja/')
    await page.getByRole('dialog', { name: /ask before we track/i })
    await page.waitForTimeout(SETTLE_MS)
    expect(thirdParty).toEqual([])
  })
})
