import { describe, expect, it } from 'vitest'
import { transformCamelStripPrimitive, transformKebabStripPrimitive } from '../config/lib.mjs'

// ─── transformKebabStripPrimitive ────────────────────────────────────────────────

describe('transformKebabStripPrimitive', () => {
  it('strips "primitive" from the path and prefixes with sanvi-', () => {
    const token = { path: ['primitive', 'color', 'blue', '600'] }
    expect(transformKebabStripPrimitive(token)).toBe('sanvi-color-blue-600')
  })

  it('handles paths without "primitive" unchanged', () => {
    const token = { path: ['color', 'background', 'primary'] }
    expect(transformKebabStripPrimitive(token)).toBe('sanvi-color-background-primary')
  })

  it('handles deep component paths', () => {
    const token = { path: ['color', 'component', 'button', 'primary', 'background', 'default'] }
    expect(transformKebabStripPrimitive(token)).toBe(
      'sanvi-color-component-button-primary-background-default',
    )
  })

  it('handles single-segment path', () => {
    const token = { path: ['sizing'] }
    expect(transformKebabStripPrimitive(token)).toBe('sanvi-sizing')
  })

  it('handles path with multiple "primitive" occurrences (strips all)', () => {
    // unlikely edge case but tests filter logic
    const token = { path: ['primitive', 'primitive', 'color'] }
    expect(transformKebabStripPrimitive(token)).toBe('sanvi-color')
  })

  it('handles empty path', () => {
    const token = { path: [] }
    expect(transformKebabStripPrimitive(token)).toBe('sanvi-')
  })
})

// ─── transformCamelStripPrimitive ────────────────────────────────────────────────

describe('transformCamelStripPrimitive', () => {
  it('strips "primitive" and produces camelCase, prefixed with sanvi', () => {
    const token = { path: ['primitive', 'color', 'blue', '600'] }
    // color → Color, blue → Blue, 600 → 600 → sanviColorBlue600
    // Actually: sanvi + Color + Blue + 600
    expect(transformCamelStripPrimitive(token)).toBe('sanviColorBlue600')
  })

  it('handles semantic paths', () => {
    const token = { path: ['color', 'background', 'primary'] }
    // color → Color, background → Background, primary → Primary
    expect(transformCamelStripPrimitive(token)).toBe('sanviColorBackgroundPrimary')
  })

  it('uppercases each segment after the first', () => {
    const token = { path: ['size', 'scale', 'md'] }
    expect(transformCamelStripPrimitive(token)).toBe('sanviSizeScaleMd')
  })

  it('handles single-segment path', () => {
    const token = { path: ['sizing'] }
    expect(transformCamelStripPrimitive(token)).toBe('sanviSizing')
  })

  it('handles empty path', () => {
    const token = { path: [] }
    expect(transformCamelStripPrimitive(token)).toBe('sanvi')
  })

  // The current implementation has a bug: every part after [0] runs
  //   p.charAt(0).toUpperCase() + p.slice(1)
  // regardless of index. This means the first part is handled by the ternary
  // (i === 0 ? ... : ...) but the else branch ALSO does charAt(0).toUpperCase().
  // This is the existing behaviour — let's test that it stays consistent.
  it('returns consistent camelCase output (existing behaviour)', () => {
    const token = { path: ['color', 'background', 'primary', 'hover'] }
    // i===0: Color   i===1+: Background  i===2+: Primary  i===3+: Hover
    expect(transformCamelStripPrimitive(token)).toBe('sanviColorBackgroundPrimaryHover')
  })
})
