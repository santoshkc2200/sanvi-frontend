import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Verifies the tokens the `ui` package's foundation components (Button,
// Field, Alert) were built against clear their WCAG target — text 4.5:1,
// non-text (focus rings, borders, icons) 3:1 — in both themes. These are
// exactly the pairings documented on `color.solid`/`color.text.inverse`/
// `color.border.focus` in semantic.json and dark.json; this test is what
// makes those doc comments a checked claim instead of an assertion.

const tokensDir = fileURLToPath(new URL('../tokens/', import.meta.url))
const primitives = JSON.parse(readFileSync(`${tokensDir}primitives.json`, 'utf8')).primitive
const light = JSON.parse(readFileSync(`${tokensDir}semantic.json`, 'utf8')).color
const dark = JSON.parse(readFileSync(`${tokensDir}dark.json`, 'utf8')).color

function resolve(node) {
  if (typeof node?.$value !== 'string') throw new Error('not a token')
  const ref = node.$value.match(/^\{(.+)\}$/)
  if (!ref) return node.$value
  const path = ref[1].split('.')
  let cur = { primitive: primitives }
  for (const segment of path) cur = cur[segment]
  return resolve(cur)
}

function hexToRgb(hex) {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function relativeLuminance([r, g, b]) {
  const [rl, gl, bl] = [r, g, b].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl
}

function contrastRatio(hexA, hexB) {
  const la = relativeLuminance(hexToRgb(hexA))
  const lb = relativeLuminance(hexToRgb(hexB))
  const [lighter, darker] = la > lb ? [la, lb] : [lb, la]
  return (lighter + 0.05) / (darker + 0.05)
}

const TEXT_MIN = 4.5
const NON_TEXT_MIN = 3

describe.each([
  ['light', light],
  ['dark', dark],
])('ui tokens — %s theme', (_name, theme) => {
  const inverse = resolve(theme.text.inverse)
  const background = resolve(theme.background.primary)

  it.each(['primary', 'secondary', 'danger'])(
    'color.text.inverse on color.solid.%s.base clears 4.5:1 (Button label)',
    (variant) => {
      expect(contrastRatio(inverse, resolve(theme.solid[variant].base))).toBeGreaterThanOrEqual(
        TEXT_MIN,
      )
    },
  )

  it.each(['primary', 'secondary', 'danger'])(
    'color.text.inverse on color.solid.%s.hover clears 4.5:1 (Button label, hover)',
    (variant) => {
      expect(contrastRatio(inverse, resolve(theme.solid[variant].hover))).toBeGreaterThanOrEqual(
        TEXT_MIN,
      )
    },
  )

  it('color.border.focus clears 3:1 against the page background (WCAG 2.4.11)', () => {
    expect(contrastRatio(resolve(theme.border.focus), background)).toBeGreaterThanOrEqual(
      NON_TEXT_MIN,
    )
  })

  it('color.border.error clears 3:1 against the page background', () => {
    expect(contrastRatio(resolve(theme.border.error), background)).toBeGreaterThanOrEqual(
      NON_TEXT_MIN,
    )
  })

  it.each(['success', 'warning', 'error'])(
    'color.status.%s clears 3:1 against color.background.secondary (Alert border/icon)',
    (status) => {
      expect(
        contrastRatio(resolve(theme.status[status]), resolve(theme.background.secondary)),
      ).toBeGreaterThanOrEqual(NON_TEXT_MIN)
    },
  )

  it('color.primary.base clears 3:1 against color.background.secondary (Alert info border)', () => {
    expect(
      contrastRatio(resolve(theme.primary.base), resolve(theme.background.secondary)),
    ).toBeGreaterThanOrEqual(NON_TEXT_MIN)
  })

  it('color.text.secondary on color.background.tertiary clears 4.5:1 (Badge neutral)', () => {
    expect(
      contrastRatio(resolve(theme.text.secondary), resolve(theme.background.tertiary)),
    ).toBeGreaterThanOrEqual(TEXT_MIN)
  })

  it.each(['success', 'warning'])(
    'color.text.inverse on color.solid.%s.base clears 4.5:1 (Badge, Alert)',
    (variant) => {
      expect(contrastRatio(inverse, resolve(theme.solid[variant].base))).toBeGreaterThanOrEqual(
        TEXT_MIN,
      )
    },
  )

  // Chart series are non-text graphics (WCAG 1.4.11): every stroke a chart
  // can draw clears 3:1 against the page background, in both themes. The
  // gridlines stay exempt — decorative.
  it.each(['spend', 'revenue', 'series.1', 'series.2', 'series.3', 'series.4'])(
    'color.chart.%s clears 3:1 against the page background (chart stroke)',
    (series) => {
      expect(contrastRatio(resolve(theme.chart[series]), background)).toBeGreaterThanOrEqual(
        NON_TEXT_MIN,
      )
    },
  )
})
