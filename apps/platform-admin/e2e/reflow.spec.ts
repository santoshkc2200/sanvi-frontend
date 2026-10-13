import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { mockBackend } from './mock-backend'

/**
 * 400% zoom / 320 px reflow (TASK-027, WCAG 1.4.10) — runs only under the
 * `reflow-400` project (320 px viewport). Same contract as the storefront's
 * spec: no horizontal document scroll, no clipped or spilling label text,
 * evidence screenshot per locale (the SPA negotiates locale from the
 * `sanvi_locale` cookie, set here per test).
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

const ROUTES = ['/', '/tenants/probe', '/audit']
const LOCALES = ['en', 'ja']

test.describe('platform-admin reflow at 320 px', () => {
  for (const locale of LOCALES) {
    for (const route of ROUTES) {
      test(`platform-admin ${route} reflows at 320 px in ${locale} @reflow`, async ({ page }) => {
        mockBackend(page)
        await page
          .context()
          .addCookies([{ name: 'sanvi_locale', value: locale, domain: 'localhost', path: '/' }])
        await page.goto(route)
        await page.waitForLoadState('networkidle')
        // The boot/route settles asynchronously; give the shell a beat.
        await page.locator('#main-content').waitFor()
        await page.waitForTimeout(300)
        await assertReflow(page)
        const label = route === '/' ? 'home' : route.replace(/\//g, '-').replace(/^-/, '')
        await page.screenshot({
          path: join(SHOTS, `platform-admin-${locale}-${label}-reflow-320.png`),
          fullPage: true,
        })
      })
    }
  }
})
