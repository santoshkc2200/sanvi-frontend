import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { mockSpaApi } from '../../../scripts/lib/spa-mock-api.mjs'
import { mockAdvertisingBackend } from './mock-advertising-backend'

/**
 * 400% zoom / 320 px reflow (TASK-027, WCAG 1.4.10) — runs only under the
 * `reflow-400` project (320 px viewport). Same contract as the storefront's
 * spec: no horizontal document scroll, no clipped or spilling label text,
 * evidence screenshot per locale (selected through the shell switcher).
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

const ROUTES = ['/', '/billing', '/advertising/dashboard']
const LOCALES = ['en', 'ja']

test.describe('admin reflow at 320 px', () => {
  for (const locale of LOCALES) {
    for (const route of ROUTES) {
      test(`admin ${route} reflows at 320 px in ${locale} @reflow`, async ({ page }) => {
        if (route === '/advertising/dashboard') {
          mockAdvertisingBackend(page, { seedTwoConnections: true, seedTwoCampaigns: true })
        } else {
          mockSpaApi(page.context(), 'admin')
        }
        await page.goto(route)
        await page.waitForLoadState('networkidle')
        // The boot/route settles asynchronously; give the shell a beat.
        await page.locator('#main-content').waitFor()
        // Switch from the default English render so ja is loaded and
        // rendered before measuring CJK reflow.
        await page.getByRole('combobox', { name: 'Switch language' }).selectOption(locale)
        await expect(page.locator('html')).toHaveAttribute('lang', locale)
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(
          route === '/billing'
            ? locale === 'ja'
              ? '課金とサブスクリプション'
              : 'Billing & Subscription'
            : route === '/advertising/dashboard'
              ? locale === 'ja'
                ? '広告パフォーマンス'
                : 'Advertising performance'
              : locale === 'ja'
                ? 'ダッシュボード'
                : 'Dashboard',
        )
        await page.waitForTimeout(300)
        if (route === '/billing') {
          await expect(page.locator('.sanvi-billing__grid')).toBeVisible()
        } else if (route === '/advertising/dashboard') {
          await expect(page.locator('.sanvi-ad-dashboard__kpis').first()).toBeVisible()
        }
        await assertReflow(page)
        const label = route === '/' ? 'home' : route.replace(/\//g, '-').replace(/^-/, '')
        await page.screenshot({
          path: join(SHOTS, `admin-${locale}-${label}-reflow-320.png`),
          fullPage: true,
        })
      })
    }
  }
})
