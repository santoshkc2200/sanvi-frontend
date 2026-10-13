import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { checkContrast, contrastRatio, parseHexColor, relativeLuminance } from '../src/contrast'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..')

describe('contrast engine math (TASK-027 step 6)', () => {
  it('parses every hex spelling the backend parses', () => {
    expect(parseHexColor('#fff')).toEqual([255, 255, 255, 255])
    expect(parseHexColor('#0000')).toEqual([0, 0, 0, 0])
    expect(parseHexColor('#0066cc')).toEqual([0, 102, 204, 255])
    expect(parseHexColor('#0066cc80')).toEqual([0, 102, 204, 128])
    expect(parseHexColor('not-a-color')).toBeNull()
    expect(parseHexColor('#12345')).toBeNull()
  })

  it('computes reference WCAG values', () => {
    // Black on white is exactly 21:1.
    expect(contrastRatio(parseHexColor('#000000'), parseHexColor('#ffffff'))).toBeCloseTo(21, 1)
    // A colour against itself is 1:1.
    expect(contrastRatio(parseHexColor('#0066cc'), parseHexColor('#0066cc'))).toBeCloseTo(1, 5)
    // Pure white's relative luminance is 1.
    expect(relativeLuminance(parseHexColor('#ffffff'))).toBeCloseTo(1, 5)
  })

  it('passes the published theme population and rejects a deliberately failing theme', () => {
    const published = JSON.parse(
      readFileSync(join(REPO_ROOT, 'scripts', 'published-themes.json'), 'utf8'),
    )
    for (const theme of published.themes) {
      const merged = { ...published.defaultTokens, ...theme.overrides }
      expect(checkContrast(merged), `published theme ${theme.key}`).toEqual([])
    }

    const failing = {
      ...published.defaultTokens,
      'color.text.primary': '#c8cdd6', // gray on white ≈ 1.9:1
    }
    const violations = checkContrast(failing)
    expect(violations.length).toBeGreaterThan(0)
    expect(violations[0].foreground).toBe('color.text.primary')
    expect(violations[0].ratio).toBeLessThan(4.5)
  })

  it('skips pairs a partial override set does not define instead of failing on absence', () => {
    expect(checkContrast({ 'color.brand.primary': '#0066cc' })).toEqual([])
  })
})
