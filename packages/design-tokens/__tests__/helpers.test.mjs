import { describe, expect, it } from 'vitest'
import { camelToSnake, hexToComposeColor, hexToXcodeColor } from '../config/lib.mjs'

// ─── camelToSnake ───────────────────────────────────────────────────────────────

describe('camelToSnake', () => {
  it('converts camelCase to snake_case', () => {
    expect(camelToSnake('fooBar')).toBe('foo_bar')
  })

  it('handles single word', () => {
    expect(camelToSnake('hello')).toBe('hello')
  })

  it('handles multiple uppercase letters', () => {
    expect(camelToSnake('colorBackgroundPrimary')).toBe('color_background_primary')
  })

  it('handles consecutive uppercase', () => {
    expect(camelToSnake('RGBColor')).toBe('_r_g_b_color')
  })

  it('handles empty string', () => {
    expect(camelToSnake('')).toBe('')
  })

  it('handles leading uppercase', () => {
    expect(camelToSnake('MyComponent')).toBe('_my_component')
  })
})

// ─── hexToXcodeColor ────────────────────────────────────────────────────────────

describe('hexToXcodeColor', () => {
  it('converts 6-char hex to Xcode color', () => {
    const result = hexToXcodeColor('#2563eb')
    expect(result).toEqual({
      'color-space': 'srgb',
      components: {
        red: (0x25 / 255).toFixed(3),
        green: (0x63 / 255).toFixed(3),
        blue: (0xeb / 255).toFixed(3),
        alpha: '1.000',
      },
    })
  })

  it('converts 3-char hex to Xcode color', () => {
    const result = hexToXcodeColor('#ace')
    expect(result).toEqual({
      'color-space': 'srgb',
      components: {
        red: (0xaa / 255).toFixed(3),
        green: (0xcc / 255).toFixed(3),
        blue: (0xee / 255).toFixed(3),
        alpha: '1.000',
      },
    })
  })

  it('converts 8-char hex to Xcode color with alpha', () => {
    const result = hexToXcodeColor('#2563eb80')
    expect(result).toEqual({
      'color-space': 'srgb',
      components: {
        red: (0x25 / 255).toFixed(3),
        green: (0x63 / 255).toFixed(3),
        blue: (0xeb / 255).toFixed(3),
        alpha: (0x80 / 255).toFixed(3),
      },
    })
  })

  it('handles uppercase hex', () => {
    const result = hexToXcodeColor('#FFFFFF')
    expect(result.components.red).toBe((255 / 255).toFixed(3))
    expect(result.components.green).toBe((255 / 255).toFixed(3))
    expect(result.components.blue).toBe((255 / 255).toFixed(3))
  })

  it('handles black', () => {
    const result = hexToXcodeColor('#000000')
    expect(result.components.red).toBe('0.000')
    expect(result.components.green).toBe('0.000')
    expect(result.components.blue).toBe('0.000')
  })

  it('throws on invalid hex length', () => {
    expect(() => hexToXcodeColor('#12345')).toThrow('unexpected hex length')
  })

  it('throws on empty hex', () => {
    expect(() => hexToXcodeColor('#')).toThrow('unexpected hex length')
  })
})

// ─── hexToComposeColor ──────────────────────────────────────────────────────────

describe('hexToComposeColor', () => {
  it('converts 6-char hex to Compose color (0xFF prefix)', () => {
    expect(hexToComposeColor('#2563eb')).toBe('0xFF2563EB')
  })

  it('converts 3-char hex to expanded Compose color', () => {
    expect(hexToComposeColor('#ace')).toBe('0xFFAACCEE')
  })

  it('converts 8-char hex (swaps alpha to front for Compose)', () => {
    // CSS: #RRGGBBAA → Compose: 0xAARRGGBB
    expect(hexToComposeColor('#2563eb80')).toBe('0x802563EB')
  })

  it('handles lowercase hex', () => {
    expect(hexToComposeColor('#abcdef')).toBe('0xFFABCDEF')
  })

  it('handles black', () => {
    expect(hexToComposeColor('#000000')).toBe('0xFF000000')
  })

  it('handles white', () => {
    expect(hexToComposeColor('#ffffff')).toBe('0xFFFFFFFF')
  })

  it('handles full alpha in 8-char', () => {
    expect(hexToComposeColor('#2563ebff')).toBe('0xFF2563EB')
  })

  it('handles zero alpha in 8-char', () => {
    expect(hexToComposeColor('#2563eb00')).toBe('0x002563EB')
  })

  it('throws on invalid hex length', () => {
    expect(() => hexToComposeColor('#12345')).toThrow('unexpected hex format')
  })

  it('throws on empty hex', () => {
    expect(() => hexToComposeColor('#')).toThrow('unexpected hex format')
  })
})
