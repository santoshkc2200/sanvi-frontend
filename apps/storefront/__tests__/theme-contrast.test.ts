import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Drift guard for the mock's publish contrast gate (TASK-027 step 6,
 * review finding C1): the storefront mock is the lab's stand-in for the
 * backend's publish rejection, and its math is a deliberate self-contained
 * copy (the fixture must boot without a built workspace). This test pins
 * that copy to `@sanvi/design-tokens`' engine — the one the admin's live
 * checker and `check:contrast` run — so the two can never disagree about a
 * theme's verdict again.
 */

const here = dirname(fileURLToPath(import.meta.url))

async function loadEngines() {
  const mock = await import(
    pathToFileURL(join(here, '..', 'e2e', 'fixtures', 'theme-contrast.mjs')).href
  )
  // Root-relative dist path: this test runs before the app build.
  const root = join(here, '..', '..', '..')
  const engine = await import(
    pathToFileURL(join(root, 'packages', 'design-tokens', 'dist', 'ts', 'index.js')).href
  )
  return { mock, engine }
}

/** Wire-shaped overrides, exactly what the mock's publish endpoint receives. */
const ov = (values: Record<string, string>) =>
  Object.fromEntries(Object.entries(values).map(([k, v]) => [k, { $value: v }]))

const THEME_MATRIX: Record<string, Record<string, { $value: string }>> = {
  defaults: {},
  dawn: ov({ 'color.brand.primary': '#0066cc' }),
  aurora: ov({ 'color.brand.primary': '#7c3aed' }),
  passingOrange: ov({ 'color.brand.primary': '#c2410c', 'color.brand.hover': '#9a3412' }),
  failingOrange: ov({ 'color.brand.primary': '#ff5500' }),
  failingText: ov({ 'color.text.primary': '#c8cdd6' }),
  failingFocus: ov({ 'color.focus.ring': '#e5e7eb' }),
}

describe('mock publish gate matches the design-tokens engine', () => {
  it('agrees on every theme in the matrix', async () => {
    const { mock, engine } = await loadEngines()
    const published = JSON.parse(
      readFileSync(join(root(here), 'scripts', 'published-themes.json'), 'utf8'),
    )
    expect(published.defaultTokens).toEqual(mock.THEME_CONTRAST_DEFAULTS)

    for (const [name, overrides] of Object.entries(THEME_MATRIX)) {
      const merged: Record<string, string> = { ...mock.THEME_CONTRAST_DEFAULTS }
      for (const [k, v] of Object.entries(overrides)) merged[k] = v.$value
      const mockVerdict = mock.themeContrastViolations(overrides)
      const engineVerdict = engine
        .checkContrast(merged)
        .map((v: { foreground: string; ratio: number; minimum: number }) => ({
          field: v.foreground,
          ratio: v.ratio,
          minimum: v.minimum,
        }))
      expect(
        mockVerdict.map((v: { field: string }) => v.field),
        `${name}: failing pairs must match`,
      ).toEqual(engineVerdict.map((v: { field: string }) => v.field))
      if (mockVerdict.length > 0) {
        expect(mockVerdict[0].message, name).toContain(`${engineVerdict[0].ratio}:1`)
      }
    }
  })

  it('uses the same pair list and minimums as the engine', async () => {
    const { mock, engine } = await loadEngines()
    const enginePairs = engine.CONTRAST_PAIRS.map(
      (p: { foreground: string; background: string; minimum: number }) => ({
        fg: p.foreground,
        bg: p.background,
        min: p.minimum,
      }),
    )
    expect(mock.THEME_CONTRAST_PAIRS).toEqual(enginePairs)
  })
})

function root(from: string): string {
  return join(from, '..', '..', '..')
}
