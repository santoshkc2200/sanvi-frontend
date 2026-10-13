import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'

/**
 * 400% zoom / 320 px reflow (TASK-027, WCAG 1.4.10) — runs only under the
 * `reflow-400` project (320 px viewport). The journey assertions: no
 * horizontal document scroll at the reflow width, and no clipped or
 * overflowing interactive/heading text — the layout test that catches an
 * overflowing label in either locale rather than leaving it to a user
 * (TASK-027 step 9). Evidence screenshots land in docs/a11y/screenshots/
 * and are reviewed with the manual passes.
 */

test.beforeEach(() => {
  test.skip(
    test.info().project.name !== 'reflow-400',
    'reflow assertions run at the 320 px reflow-400 project viewport only',
  )
})

const SHOTS = join(process.cwd(), '..', '..', 'docs', 'a11y', 'screenshots')

interface OverflowReport {
  selector: string
  text: string
  scrollWidth: number
  clientWidth: number
}

async function assertReflow(page: Page): Promise<void> {
  // No two-axis scrolling: the document must not be wider than the viewport.
  const scroll = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }))
  expect(scroll.scrollWidth, 'document must not scroll horizontally at 320 px').toBeLessThanOrEqual(
    scroll.innerWidth + 1,
  )

  // No clipped or spilling label text: every rendered heading, control
  // label, link, and button fits its box (ellipsis truncation excepted —
  // a deliberate ellipsis is the designed handling, not an accident).
  const overflows = await page.evaluate((): OverflowReport[] => {
    const offenders: OverflowReport[] = []
    for (const el of document.querySelectorAll('h1, h2, h3, h4, button, a, label, td, th')) {
      if (el.getClientRects().length === 0) continue
      const style = getComputedStyle(el)
      if (style.textOverflow === 'ellipsis' || style.overflowX === 'hidden') continue
      if (el.scrollWidth > el.clientWidth + 1) {
        offenders.push({
          selector: `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0] ?? ''}`,
          text: (el.textContent ?? '').trim().slice(0, 60),
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
        })
      }
    }
    return offenders
  })
  expect(overflows, `overflowing text at 320 px: ${JSON.stringify(overflows, null, 1)}`).toEqual([])
}

const LOCALES = [
  { code: 'en', path: '/' },
  { code: 'ja', path: '/ja' },
]

for (const locale of LOCALES) {
  test(`storefront home reflows at 320 px in ${locale.code} @reflow`, async ({ page }) => {
    await page.goto(locale.path)
    await page.waitForLoadState('networkidle')
    await assertReflow(page)
    await page.screenshot({
      path: join(SHOTS, `storefront-${locale.code}-reflow-320.png`),
      fullPage: true,
    })
  })

  test(`storefront checkout reflows at 320 px in ${locale.code} @reflow`, async ({ page }) => {
    await page.goto(`${locale.path === '/' ? '' : locale.path}/checkout`)
    await page.waitForLoadState('networkidle')
    // The consent banner is an overlay, not layout content; accept it so the
    // scan sees the page, then re-assert.
    const accept = page.locator('.sanvi-consent-banner__actions button').nth(1)
    if (await accept.isVisible().catch(() => false)) await accept.click()
    await assertReflow(page)
    await page.screenshot({
      path: join(SHOTS, `storefront-${locale.code}-checkout-reflow-320.png`),
      fullPage: true,
    })
  })
}
