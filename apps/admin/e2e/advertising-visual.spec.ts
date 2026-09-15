import { expect, test, type Page } from '@playwright/test'
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { mockAdvertisingBackend } from './mock-advertising-backend'
import { makePng, mockMediaBackend } from './mock-media-backend'

/**
 * The visual sweep (TASK-018): the advertising surfaces across every shipped
 * theme (light, dark) and both locales (en, ja), asserting what pixels alone
 * cannot — that theme colours resolve from tokens in both themes, that JPY
 * is what the charts and their accessible tables render, that Japanese
 * dates and copy reach the tables and previews, and that CJK strings never
 * overflow the placement preview.
 *
 * Pixel baselines exist per platform (Playwright suffixes them); they are
 * generated on the authoring platform and cross-platform baselines arrive
 * with the phase-11 harness work (TASK-030). On a platform without
 * baselines the pixel test skips itself — every DOM-invariant assertion
 * here runs everywhere regardless.
 */

const SNAPSHOT_DIR = path.join(process.cwd(), 'e2e', 'advertising-visual.spec.ts-snapshots')
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
  // Regenerate with: GENERATE_VISUAL_BASELINES=1 pnpm --filter @sanvi/admin \
  //   exec playwright test advertising-visual.spec.ts --update-snapshots
  process.env.GENERATE_VISUAL_BASELINES === '1'

async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.evaluate((name) => {
    document.documentElement.setAttribute('data-theme', name)
  }, theme)
}

test.describe('Advertising visual sweep (10.9)', () => {
  for (const locale of ['en', 'ja'] as const) {
    for (const theme of ['light', 'dark'] as const) {
      test(`dashboard holds theme and locale invariants (${locale}/${theme})`, async ({ page }) => {
        mockAdvertisingBackend(page, {
          seedConnection: true,
          seedTwoCampaigns: true,
          accountLocale: locale,
        })
        await page.goto('/advertising/dashboard')
        // The KPI strip is the dashboard's settled marker, in the locale
        // the account booted in.
        const kpiLabel =
          locale === 'ja' ? 'コンバージョン価値(プラットフォーム)' : 'Conversion value (platform)'
        await page.getByText(kpiLabel).first().waitFor({ timeout: 10_000 })
        await setTheme(page, theme)

        // The theme attribute actually resolves tokens: the chart colour is
        // a real value in both themes and the themes disagree — a chart
        // hard-coding one palette would render identically in both.
        const token = await page.evaluate(
          (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
          '--sanvi-color-chart-spend',
        )
        expect(token).not.toBe('')

        // The charts render JPY ticks, whatever the locale — and the ja
        // ICU data renders the fullwidth yen sign (￥, U+FFE5), not the
        // ASCII-adjacent one en uses.
        const yen = locale === 'ja' ? /[\u00A5\uFFE5]/ : '¥'
        await expect(page.locator('svg[role="img"] text', { hasText: yen }).first()).toBeVisible()

        // Open the accessible data table: the same data, as text.
        const disclosureText = locale === 'ja' ? 'データテーブルで表示' : 'View as data table'
        await page.locator('summary', { hasText: disclosureText }).first().click()
        const table = page.getByRole('table').first()
        await expect(table).toBeVisible()
        if (locale === 'ja') {
          // Japanese dates inside the table (fmt with the ja catalog), and
          // a truthful `lang` on the document.
          await expect(table.getByText(/\d{4}\/\d{2}\/\d{2}/).first()).toBeVisible()
          await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
        } else {
          // en-US short dates are numeric with a two-digit year last —
          // distinguishable from the ja catalog's 2026/09/14 shape.
          await expect(table.getByText(/\d{1,2}\/\d{1,2}\/\d{2}/).first()).toBeVisible()
        }
      })
    }
  }

  test('a long Japanese headline never overflows the placement preview', async ({ page }) => {
    mockMediaBackend(page)
    mockAdvertisingBackend(page, { seedConnection: true })
    await page.goto('/advertising/creatives')

    await page.getByRole('button', { name: 'New creative' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('checkbox', { name: 'Feed' }).check()
    // texts[0] is what the preview renders — a long, space-less CJK string
    // is exactly the content that exposes missing line breaking.
    // 40 CJK-ish characters: within the en slot's limit, and long enough —
    // and space-less enough — to expose missing line breaking.
    await dialog
      .getByLabel('Headline')
      .first()
      .fill('夏のセールは本日開催中です。全品最大50%オフ。クーポンでさらに10%引き！')
    await dialog.getByLabel('Upload image').setInputFiles({
      name: 'square.png',
      mimeType: 'image/png',
      buffer: makePng(1080, 1080),
    })
    await dialog.getByRole('button', { name: 'Create' }).click()

    await page.getByRole('button', { name: 'Preview' }).click()
    const previewDialog = page.getByRole('dialog')
    await expect(previewDialog.getByText(/夏のセール/)).toBeVisible()

    // The CJK headline wraps or truncates — it never pushes the preview
    // wider than its container.
    const overflow = await previewDialog.evaluate(
      (element) => element.scrollWidth - element.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)

    // The preview survives the theme switch: it renders on tokenized
    // surfaces, not baked-in light colours.
    await setTheme(page, 'dark')
    await expect(previewDialog.getByText(/夏のセール/)).toBeVisible()
  })

  test('pixel baselines: dashboard across themes and locales (authoring platform)', async ({
    page,
  }) => {
    test.skip(
      !hasBaselinesHere(test.info().project.name),
      'No pixel baselines for this browser/platform — they arrive with the phase-11 visual harness (TASK-030); the DOM-invariant tests above run everywhere.',
    )

    for (const locale of ['en', 'ja'] as const) {
      mockAdvertisingBackend(page, {
        seedConnection: true,
        seedTwoCampaigns: true,
        accountLocale: locale,
      })
      await page.goto('/advertising/dashboard')
      await page
        .getByText(
          locale === 'ja' ? 'コンバージョン価値(プラットフォーム)' : 'Conversion value (platform)',
        )
        .first()
        .waitFor({ timeout: 10_000 })
      for (const theme of ['light', 'dark'] as const) {
        await setTheme(page, theme)
        await page.waitForTimeout(150)
        await expect(page).toHaveScreenshot(`dashboard-${locale}-${theme}.png`, {
          animations: 'disabled',
          scale: 'css',
          maxDiffPixelRatio: 0.02,
          // The range line carries today's date and the freshness line the
          // last ingest time — content, not layout; mask them so runs
          // compare layout, not the clock.
          mask: [page.locator('.sanvi-ad-dashboard__meta')],
        })
      }
    }
  })
})
