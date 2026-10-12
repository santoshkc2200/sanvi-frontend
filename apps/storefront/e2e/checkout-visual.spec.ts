import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { expect, type Page, test } from '@playwright/test'

/**
 * The payments visual sweep (TASK-008): the checkout summary and the
 * confirmation across every shipped theme (light, dark) and both locales
 * (en, ja), asserting what pixels alone cannot — that the settlement
 * currency renders as JPY with the right yen sign per locale, that the
 * Japanese pages apply the CJK typography contract and never overflow
 * horizontally, and that a store that cannot accept payments says so
 * instead of drawing a dead button.
 *
 * Pixel baselines exist per platform (Playwright suffixes them); they are
 * generated on the authoring platform and cross-platform baselines arrive
 * with the phase-11 harness work (TASK-030). On a platform without
 * baselines the pixel test skips itself — every DOM-invariant assertion
 * here runs everywhere regardless.
 */

const SNAPSHOT_DIR = path.join(process.cwd(), 'e2e', 'checkout-visual.spec.ts-snapshots')
// Baselines are rendered per browser and per OS (Playwright names them
// `…-{browser}-{platform}.png`); a browser/platform pair without its own
// baseline file skips instead of comparing against another engine's pixels.
const hasBaselinesHere = (browserName: string): boolean =>
  (existsSync(SNAPSHOT_DIR) &&
    readdirSync(SNAPSHOT_DIR).some(
      (file) =>
        file.endsWith('.png') &&
        file.includes(`-${browserName}-`) &&
        file.includes(process.platform),
    )) ||
  // Regenerate with: GENERATE_VISUAL_BASELINES=1 pnpm --filter @sanvi/storefront \
  //   exec playwright test checkout-visual.spec.ts --update-snapshots
  process.env.GENERATE_VISUAL_BASELINES === '1'

const COPY: Record<
  'en' | 'ja',
  {
    title: string
    payButton: string
    confirmation: string
    amountPaid: string
    cannotAccept: string
    /** en always renders the ASCII-adjacent U+00A5; ja's fullwidth U+FFE5 is
     *  Chromium ICU data — WebKit's ja locale formats JPY with U+00A5, so
     *  the ja assertion accepts either sign (same convention as the
     *  advertising visual sweep). */
    yen: string | RegExp
  }
> = {
  en: {
    title: 'Order summary',
    payButton: 'Proceed to checkout',
    confirmation: 'Payment confirmed',
    amountPaid: 'Amount paid',
    cannotAccept: 'This store cannot accept payments right now.',
    yen: '¥',
  },
  ja: {
    title: 'ご注文内容の確認',
    payButton: '注文を確定して支払う',
    confirmation: 'お支払いが完了しました',
    amountPaid: 'お支払い金額',
    cannotAccept: 'このストアは現在お支払いを受け付けることができません。',
    yen: /[\u00A5\uFFE5]/,
  },
}

async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.evaluate((name) => {
    document.documentElement.setAttribute('data-theme', name)
  }, theme)
}

/**
 * The consent banner floats over the page bottom (EU opt-in is the mock's
 * default jurisdiction) and shifts layout through its spacer — it must be
 * gone before anything is measured or screenshotted. Button order in the
 * banner is reject, accept, choose; accepting keeps the assertion free of
 * locale-specific copy. The click auto-waits briefly so a banner still
 * hydrating cannot race a one-shot visibility check.
 */
async function dismissConsentBanner(page: Page): Promise<void> {
  const accept = page.locator('.sanvi-consent-banner__actions button').nth(1)
  try {
    await accept.click({ timeout: 2_000 })
    await expect(page.locator('.sanvi-consent-banner')).toBeHidden()
  } catch {
    // Already dismissed (a choice cookie from an earlier navigation).
  }
}

/**
 * The SSR stale-content banner is a honesty requirement, not a layout
 * feature — and whether a given request is served from the tenant cache's
 * fresh window (TENANT_CACHE_FRESH_MS=2s in this harness) or its
 * stale-while-revalidate window is wall-clock timing no test can pin. It
 * shifts the whole page by its own height, so pixel tests remove it from
 * layout: both cache states then render identically. The DOM-invariant
 * tests do not need this — nothing they assert moves.
 */
async function hideStaleBanner(page: Page): Promise<void> {
  // A style *attribute*, not an injected <style>: the tightened CSP blocks
  // inline style elements (TASK-024) while the recorded style-attr exception
  // covers element style manipulation.
  await page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>('.sanvi-stale-banner')) {
      el.style.display = 'none'
    }
  })
}

test.describe('Checkout visual sweep (TASK-008)', () => {
  for (const locale of ['en', 'ja'] as const) {
    for (const theme of ['light', 'dark'] as const) {
      const prefix = locale === 'en' ? '' : '/ja'
      const copy = COPY[locale]

      test(`order summary holds currency, locale and theme invariants (${locale}/${theme})`, async ({
        page,
      }) => {
        // The conversion beacon is out of scope here; keep it from firing
        // while the confirmation screenshots settle.
        await page.route('**/api/v1/public/track', (route) => route.fulfill({ status: 202 }))

        await page.goto(`${prefix}/checkout`)
        await dismissConsentBanner(page)

        // The pre-flight config has landed once the pay button is enabled —
        // before that the currency (and the whole table) is deliberately
        // absent.
        const pay = page.getByRole('button', { name: copy.payButton })
        await expect(pay).toBeEnabled({ timeout: 10_000 })
        await setTheme(page, theme)

        await expect(page.locator('html')).toHaveAttribute('lang', locale)

        // The sample cart prices in the account's settlement currency, and
        // the yen sign is the locale's — a hard-coded sign would render the
        // same in both.
        const yenCell = page.locator('.sanvi-checkout-td-price').first()
        await expect(yenCell).toContainText(copy.yen)
        await expect(yenCell).toContainText('4,800')
        await expect(page.locator('.sanvi-checkout-table')).toBeVisible()
        await expect(page.locator('.sanvi-checkout-tax-note')).toBeVisible()

        if (locale === 'ja') {
          // Phase-06 CJK typography: the ja face applies, and a page of
          // Japanese copy never scrolls horizontally.
          const font = await page.locator('h1').evaluate((el) => getComputedStyle(el).fontFamily)
          expect(font).toContain('Noto Sans JP')
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          )
          expect(overflow).toBeLessThanOrEqual(1)
        }
      })

      test(`confirmation holds currency and locale invariants (${locale}/${theme})`, async ({
        page,
      }) => {
        await page.route('**/api/v1/public/track', (route) => route.fulfill({ status: 202 }))

        // The mock answers every checkout status poll with the same paid
        // session: JPY 4,800, reference `ord-beacon-1`.
        await page.goto(`${prefix}/checkout/return?id=chk_visual_${locale}`)
        await dismissConsentBanner(page)
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(copy.confirmation, {
          timeout: 10_000,
        })
        // ssr=false: hide the stale banner only after the client render has
        // settled — see the order-summary matrix test.
        await hideStaleBanner(page)
        await setTheme(page, theme)

        await expect(page.locator('html')).toHaveAttribute('lang', locale)
        const total = page.locator('.sanvi-confirmation-total-row')
        await expect(total).toContainText(copy.amountPaid)
        await expect(total).toContainText(copy.yen)
        await expect(total).toContainText('4,800')

        if (locale === 'ja') {
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          )
          expect(overflow).toBeLessThanOrEqual(1)
        }
      })
    }
  }

  test('a store that cannot accept payments says so instead of drawing a dead button', async ({
    page,
  }) => {
    // Override the pre-flight: same shape, readiness off.
    await page.route('**/api/v1/tenant/checkout/config', (route) =>
      route.fulfill({
        json: {
          can_accept_payments: false,
          cannot_accept_reason: 'payments.blocker.card_payments_inactive',
          currency: 'JPY',
          tax_enabled: true,
        },
      }),
    )

    await page.goto('/checkout')
    await dismissConsentBanner(page)

    const copy = COPY.en
    await expect(page.getByText(copy.title)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('button', { name: copy.payButton })).toBeDisabled()
    await expect(page.getByText(copy.cannotAccept).first()).toBeVisible()
  })

  for (const locale of ['en', 'ja'] as const) {
    for (const theme of ['light', 'dark'] as const) {
      const prefix = locale === 'en' ? '' : '/ja'

      test(`pixel baselines: order summary and confirmation (${locale}/${theme})`, async ({
        page,
      }) => {
        test.skip(
          !hasBaselinesHere(test.info().project.name),
          'No pixel baselines for this browser/platform — they arrive with the phase-11 visual harness (TASK-030); the DOM-invariant tests above run everywhere.',
        )

        await page.route('**/api/v1/public/track', (route) => route.fulfill({ status: 202 }))

        await page.goto(`${prefix}/checkout`)
        await dismissConsentBanner(page)
        // Both checkout pages are ssr=false: the layout — and its stale
        // banner — render client-side after the load resolves, so the banner
        // can only be hidden once the page has settled (staleness is decided
        // once per load; after render it cannot reappear).
        await expect(page.getByRole('button', { name: COPY[locale].payButton })).toBeEnabled({
          timeout: 10_000,
        })
        await hideStaleBanner(page)
        await setTheme(page, theme)
        await page.evaluate(() => document.fonts.ready)
        await page.waitForTimeout(150)
        await expect(page).toHaveScreenshot(`checkout-summary-${locale}-${theme}.png`, {
          animations: 'disabled',
          scale: 'css',
          maxDiffPixelRatio: 0.02,
        })

        await page.goto(`${prefix}/checkout/return?id=chk_visual_${locale}`)
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(
          COPY[locale].confirmation,
          { timeout: 10_000 },
        )
        await hideStaleBanner(page)
        await setTheme(page, theme)
        await page.evaluate(() => document.fonts.ready)
        await page.waitForTimeout(150)
        await expect(page).toHaveScreenshot(`checkout-confirmation-${locale}-${theme}.png`, {
          animations: 'disabled',
          scale: 'css',
          maxDiffPixelRatio: 0.02,
        })
      })
    }
  }
})
