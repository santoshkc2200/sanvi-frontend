import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Verifies the course-feature tokens added in course-ux-plan.md Phase 1
// (color.learn.*, color.accent.course.*, color.state.*) resolve in both
// themes and clear WCAG 1.4.11 non-text contrast (3:1) against the page
// background they're drawn on — the spine, accent rule and quiz states are
// all graphical marks, never body text, so 3:1 is the applicable target
// (not the 4.5:1 body-text ratio).

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

const NON_TEXT_MIN = 3

describe.each([
  ['light', light],
  ['dark', dark],
])('course tokens — %s theme', (_name, theme) => {
  const background = resolve(theme.background.primary)

  it('color.learn.spine clears 3:1 against the page background', () => {
    expect(contrastRatio(resolve(theme.learn.spine), background)).toBeGreaterThanOrEqual(
      NON_TEXT_MIN,
    )
  })

  it('color.learn.spine-progress clears 3:1 against the page background', () => {
    expect(
      contrastRatio(resolve(theme.learn['spine-progress']), background),
    ).toBeGreaterThanOrEqual(NON_TEXT_MIN)
  })

  it.each(['1', '2', '3', '4', '5', '6'])(
    'color.accent.course.%s clears 3:1 against the page background',
    (n) => {
      expect(contrastRatio(resolve(theme.accent.course[n]), background)).toBeGreaterThanOrEqual(
        NON_TEXT_MIN,
      )
    },
  )

  it.each(['correct', 'incorrect', 'pending'])(
    'color.state.%s clears 3:1 against the page background',
    (state) => {
      expect(contrastRatio(resolve(theme.state[state]), background)).toBeGreaterThanOrEqual(
        NON_TEXT_MIN,
      )
    },
  )
})

describe('accent.course distribution', () => {
  it('assigns six distinct colors in each theme', () => {
    for (const theme of [light, dark]) {
      const values = ['1', '2', '3', '4', '5', '6'].map((n) => resolve(theme.accent.course[n]))
      expect(new Set(values).size).toBe(6)
    }
  })
})
