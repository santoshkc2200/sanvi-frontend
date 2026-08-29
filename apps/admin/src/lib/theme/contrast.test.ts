import { describe, expect, it } from 'vitest'
import { checkContrast, contrastRatio, parseHexColor } from './contrast'

describe('Contrast Checker (Backend Parity)', () => {
  it('ratio extremes match backend fixtures', () => {
    const black = parseHexColor('#000000')!
    const white = parseHexColor('#ffffff')!

    expect(black).toBeDefined()
    expect(white).toBeDefined()

    expect(Math.abs(contrastRatio(black, white) - 21.0)).toBeLessThan(0.01)
    expect(Math.abs(contrastRatio(white, white) - 1.0)).toBeLessThan(0.01)

    // Fully transparent black composites against white to white -> ratio 1.0 with white
    const transparentBlack: [number, number, number, number] = [0, 0, 0, 0]
    expect(Math.abs(contrastRatio(transparentBlack, white) - 1.0)).toBeLessThan(0.01)
  })

  it('known-good palette passes with zero violations', () => {
    const tokens = {
      'color.text.primary': '#1a1d23',
      'color.text.secondary': '#4a505c',
      'color.text.inverse': '#ffffff',
      'color.background.primary': '#ffffff',
      'color.background.inverse': '#1a1d23',
      'color.brand.primary': '#2563eb',
      'color.brand.hover': '#1d4ed8',
      'color.brand.contrast': '#ffffff',
      'color.focus.ring': '#1d4ed8',
    }

    const violations = checkContrast(tokens)
    expect(violations).toEqual([])
  })

  it('known-bad palette reports violations', () => {
    const tokens = {
      'color.text.primary': '#94a3b8',
      'color.text.secondary': '#cbd5e1',
      'color.text.inverse': '#ffffff',
      'color.background.primary': '#ffffff',
      'color.background.inverse': '#1a1d23',
      'color.brand.primary': '#fde047',
      'color.brand.hover': '#fde047',
      'color.brand.contrast': '#ffffff',
      'color.focus.ring': '#ffffff',
    }

    const violations = checkContrast(tokens)
    expect(violations.length).toBeGreaterThan(0)

    const violatedPairs = violations.map((v) => `${v.foreground} on ${v.background}`)
    expect(violatedPairs).toContain('color.text.primary on color.background.primary')
    expect(violatedPairs).toContain('color.brand.contrast on color.brand.primary')
  })

  it('missing pairs are skipped without failure', () => {
    const sparse = {
      'color.brand.primary': '#2563eb',
      'color.brand.contrast': '#ffffff',
    }

    const violations = checkContrast(sparse)
    expect(violations).toEqual([])
  })
})
