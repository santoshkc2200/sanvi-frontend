import { expect, test } from '@playwright/test'
import { setPrivacyContext } from './fixtures/privacy-context'

/**
 * TASK-022 step 3 — the Japanese font-swap shift test.
 *
 * The ja pages render first in the metric-compatible fallback face
 * ("Noto Sans JP Fallback", see `@sanvi/ui`'s reset.css) while the CJK web
 * font streams in with `font-display: swap`. This test measures the same
 * page with the web font blocked (fallback-only layout) and with it loaded,
 * and asserts the layout did not move: that is the CLS-theft the rc.1/rc.3
 * baselines measured (0.1369) and the metric overrides exist to kill.
 *
 * Blocked-run vs loaded-run, not a mid-load race: comparing two settled
 * layouts isolates exactly the font's contribution to geometry.
 */

interface Probe {
  bodyHeight: number
  firstTextTop: number
  firstTextHeight: number
  /** Em-box height at `line-height: normal` — the metric-compatibility contract. */
  emBoxHeight: number
}

async function measureJaLayout(page: import('@playwright/test').Page): Promise<Probe> {
  return page.evaluate(() => {
    const probe = document.querySelector<HTMLElement>('h1, main p, footer p')
    const box = probe?.getBoundingClientRect()

    // The page's own text carries explicit line-heights (the ja token block),
    // which mask em-metric differences — the classic "test passes but CLS
    // regressed" trap. This probe isolates exactly what the fallback
    // `@font-face` overrides promise: under `line-height: normal`, a block's
    // height is the active face's ascent+descent, so Noto and its metric-
    // compatible fallback must measure identically here. Unmitigated local
    // faces measure ~11 % lower (Yu Gothic 98/30 vs Noto's 116/29 per em)
    // and every normal-line-height box on the page re-flows at swap time.
    const emProbe = document.createElement('div')
    emProbe.style.cssText =
      'position:absolute;visibility:hidden;line-height:normal;white-space:pre;font-family:var(--sanvi-font-family-sans)'
    emProbe.textContent = 'あいうえお漢字テスト表示'
    document.body.appendChild(emProbe)
    const emBoxHeight = emProbe.getBoundingClientRect().height
    emProbe.remove()

    return {
      bodyHeight: document.body.scrollHeight,
      firstTextTop: box?.top ?? -1,
      firstTextHeight: box?.height ?? -1,
      emBoxHeight,
    }
  })
}

test('the ja font swap does not shift layout (metric-compatible fallback)', async ({ page }) => {
  await setPrivacyContext(page, { jurisdiction: 'eu' })

  // Fallback-only: block every CJK subset the page can discover — the two
  // vendored preloads and the unicode-range faces the CSS references.
  await page.route('**/noto-sans-jp-*.woff2', (route) => route.abort())
  await page.goto('/ja/')
  await page.evaluate(() => document.fonts.ready)
  const fallback = await measureJaLayout(page)

  // Web font loaded: same page, subsets allowed through.
  await page.unroute('**/noto-sans-jp-*.woff2')
  await page.goto('/ja/')
  // The loaded face must actually be the web font, or the comparison is
  // fallback-vs-fallback and proves nothing. `fonts.ready` alone can resolve
  // before any face starts loading; an explicit `load()` of the face with a
  // CJK sample waits for the bytes the page actually renders with.
  const webFontLoaded = await page.evaluate(async () => {
    await document.fonts.load('16px "Noto Sans JP Variable"', 'あ漢字テスト表示')
    await document.fonts.ready
    const noto = [...document.fonts].filter((f) => f.family.includes('Noto Sans JP'))
    return noto.length > 0 && noto.some((f) => f.status === 'loaded')
  })
  expect(webFontLoaded).toBe(true)

  const webFont = await measureJaLayout(page)

  // Metric-matched faces: geometry is identical. The thresholds leave room
  // for a single sub-pixel rounding, nothing more — the un-fixed local stack
  // measures the em box ~11 % shorter (Yu Gothic 98/30 vs Noto's 116/29 per
  // em), and every normal-line-height box re-flows at swap time.
  expect(Math.abs(webFont.bodyHeight - fallback.bodyHeight)).toBeLessThanOrEqual(2)
  expect(Math.abs(webFont.firstTextTop - fallback.firstTextTop)).toBeLessThanOrEqual(1)
  expect(Math.abs(webFont.firstTextHeight - fallback.firstTextHeight)).toBeLessThanOrEqual(1)
  expect(Math.abs(webFont.emBoxHeight - fallback.emBoxHeight)).toBeLessThanOrEqual(0.5)
})
