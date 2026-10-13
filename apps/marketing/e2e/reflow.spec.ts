import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'

/**
 * 400% zoom / 320 px reflow (TASK-027, WCAG 1.4.10) — runs only under the
 * `reflow-400` project (320 px viewport). Same contract as the storefront's
 * spec: no horizontal document scroll, no clipped or spilling label text,
 * evidence screenshot per locale.
 */

test.beforeEach(() => {
  test.skip(
    test.info().project.name !== 'reflow-400',
    'reflow assertions run at the 320 px reflow-400 project viewport only',
  )
})

const SHOTS = join(process.cwd(), '..', '..', 'docs', 'a11y', 'screenshots')

async function assertReflow(page: Page): Promise<void> {
  const scroll = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }))
  expect(scroll.scrollWidth, 'document must not scroll horizontally at 320 px').toBeLessThanOrEqual(
    scroll.innerWidth + 1,
  )

  const overflows = await page.evaluate((): { what: string; text: string }[] => {
    const offenders: { what: string; text: string }[] = []
    for (const el of document.querySelectorAll('h1, h2, h3, h4, button, a, label, td, th')) {
      if (el.getClientRects().length === 0) continue
      const style = getComputedStyle(el)
      if (style.textOverflow === 'ellipsis' || style.overflowX === 'hidden') continue
      if (el.scrollWidth > el.clientWidth + 1) {
        offenders.push({
          what: `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0] ?? ''}`,
          text: (el.textContent ?? '').trim().slice(0, 60),
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
  test(`marketing home reflows at 320 px in ${locale.code} @reflow`, async ({ page }) => {
    await page.goto(locale.path)
    await page.waitForLoadState('networkidle')
    await assertReflow(page)
    await page.screenshot({
      path: join(SHOTS, `marketing-${locale.code}-reflow-320.png`),
      fullPage: true,
    })
  })
}
