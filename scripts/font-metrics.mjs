#!/usr/bin/env node
/**
 * `node scripts/font-metrics.mjs`
 *
 * Derives the metric-override values for the Japanese web font's
 * metric-compatible fallback face (TASK-022, step 3) by measuring the *real*
 * build under the pinned Chrome — the storefront /ja/ page, its actual
 * `@fontsource-variable/noto-sans-jp` faces, and the local system JP fonts
 * this machine/browser actually resolves for the fallback stack.
 *
 * Method (same math `fontaine`/next-font use, measured instead of read from
 * the binary): render one probe string at 100px in both faces via canvas
 * `measureText`, then
 *
 *   size-adjust       = width_noto / width_fallback
 *   ascent-override   = (ascent_noto / 100) / size-adjust
 *   descent-override  = (descent_noto / 100) / size-adjust
 *   line-gap-override = 0 (Noto Sans JP ships no line gap)
 *
 * Re-run whenever `@fontsource-variable/noto-sans-jp` is bumped or the
 * fallback stack changes, and paste the numbers into
 * `packages/ui/src/styles/reset.css`'s fallback `@font-face`.
 */
import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { findWorkspaceRoot } from '@sanvi/lint-gates/perf-profiles'
import { serveApp, startStorefrontMockApi } from './lib/serving.mjs'

const ROOT = findWorkspaceRoot()
const PROBE =
  'あいうえおかきくけさしすせそたちつてなにぬねのはひふへほまみむめも漢字テスト表示商品価格お知らせ新着期間限定'
const FALLBACK_STACK =
  '"Hiragino Kaku Gothic ProN","Hiragino Sans","Yu Gothic UI","Yu Gothic","Meiryo UI","Meiryo",system-ui,sans-serif'
const LOCALS = [
  'Hiragino Kaku Gothic ProN',
  'Hiragino Sans',
  'Yu Gothic UI',
  'Yu Gothic',
  'Meiryo UI',
  'Meiryo',
]

/** Same resolution order as check-lighthouse: $CHROME_PATH, then the Playwright browser cache. */
function resolveChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  const winRoot = join(process.env.LOCALAPPDATA ?? '', 'ms-playwright')
  const cacheRoot = join(process.env.HOME ?? '', 'Library', 'Caches', 'ms-playwright')
  const linuxRoot = join(process.env.HOME ?? '', '.cache', 'ms-playwright')
  for (const root of [winRoot, cacheRoot, linuxRoot]) {
    try {
      for (const name of readdirSync(root)) {
        if (!name.startsWith('chrome-for-testing-') && !name.startsWith('chromium-')) continue
        for (const rel of [
          join(name, 'chrome-win64', 'chrome.exe'),
          join(
            name,
            'chrome-mac-arm64',
            'Google Chrome for Testing.app',
            'Contents',
            'MacOS',
            'Google Chrome for Testing',
          ),
          join(
            name,
            'chrome-mac',
            'Google Chrome for Testing.app',
            'Contents',
            'MacOS',
            'Google Chrome for Testing',
          ),
          join(name, 'chrome-linux', 'chrome'),
        ]) {
          const full = join(root, rel)
          if (existsSync(full)) return full
        }
      }
    } catch {
      // not this root
    }
  }
  throw new Error('font-metrics: no Chrome found — set CHROME_PATH')
}

const measure = `(async () => {
  const PROBE = ${JSON.stringify(PROBE)}
  const stack = ${JSON.stringify(FALLBACK_STACK)}

  // Which local faces actually exist here? document.fonts.check() answers
  // for installed system families too, given a sample text in the script.
  const locals = {}
  for (const family of ${JSON.stringify(LOCALS)}) {
    locals[family] = document.fonts.check('16px "' + family + '"', 'あ')
  }

  const webFontFamilies = [...new Set([...document.fonts].map((f) => f.family))]
  await document.fonts.load('100px "Noto Sans JP Variable"', PROBE)
  await document.fonts.ready

  const ctx = document.createElement('canvas').getContext('2d')
  function metricsOf(font) {
    ctx.font = '100px ' + font
    const m = ctx.measureText(PROBE)
    return {
      width: m.width,
      ascent: m.fontBoundingBoxAscent,
      descent: m.fontBoundingBoxDescent,
    }
  }
  return { locals, webFontFamilies, noto: metricsOf('"Noto Sans JP Variable"'), fallback: metricsOf(stack) }
})()`

async function main() {
  const { chromium } = await import('@playwright/test')
  const mockApi = await startStorefrontMockApi()
  const server = await serveApp('storefront', 4174)
  let browser
  try {
    browser = await chromium.launch({ executablePath: resolveChrome() })
    const page = await browser.newPage()
    await page.goto('http://localhost:4174/ja/', { waitUntil: 'networkidle' })
    const result = await page.evaluate(measure)
    console.log(JSON.stringify(result, null, 2))

    const { noto, fallback } = result
    if (!noto.width || !fallback.width) throw new Error('font-metrics: zero-width measurement')
    const sizeAdjust = noto.width / fallback.width
    const ascent = noto.ascent / 100 / sizeAdjust
    const descent = noto.descent / 100 / sizeAdjust
    console.log('\nDerived overrides (paste into reset.css fallback @font-face):')
    console.log(`  size-adjust: ${(sizeAdjust * 100).toFixed(2)}%;`)
    console.log(`  ascent-override: ${(ascent * 100).toFixed(2)}%;`)
    console.log(`  descent-override: ${(descent * 100).toFixed(2)}%;`)
    console.log('  line-gap-override: 0%;')
  } finally {
    await browser?.close()
    server.stop()
    mockApi.stop()
  }
}

await main()
