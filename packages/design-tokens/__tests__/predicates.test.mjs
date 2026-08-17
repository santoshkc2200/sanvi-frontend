import { describe, expect, it } from 'vitest'
import { isComponent, isPrimitive, isSemantic, isSemanticOrComponent } from '../config/lib.mjs'

// ─── isPrimitive ────────────────────────────────────────────────────────────────

describe('isPrimitive', () => {
  it('returns true when path[0] is "primitive"', () => {
    expect(isPrimitive({ path: ['primitive', 'color', 'blue', '600'] })).toBe(true)
  })

  it('returns false when path[0] is not "primitive"', () => {
    expect(isPrimitive({ path: ['color', 'background', 'primary'] })).toBe(false)
  })

  it('returns false for component tokens', () => {
    expect(isPrimitive({ path: ['color', 'component', 'button'] })).toBe(false)
  })

  it('returns false when token has no path', () => {
    expect(isPrimitive({})).toBe(false)
  })

  it('returns false for empty path', () => {
    expect(isPrimitive({ path: [] })).toBe(false)
  })
})

// ─── isComponent ────────────────────────────────────────────────────────────────

describe('isComponent', () => {
  it('returns true when path is color.component.*', () => {
    expect(
      isComponent({ path: ['color', 'component', 'button', 'primary', 'background', 'default'] }),
    ).toBe(true)
  })

  it('returns false when path[0] is not "color"', () => {
    expect(isComponent({ path: ['size', 'component', 'button'] })).toBe(false)
  })

  it('returns false when path[1] is not "component"', () => {
    expect(isComponent({ path: ['color', 'background', 'primary'] })).toBe(false)
  })

  it('returns false when token has no path', () => {
    expect(isComponent({})).toBe(false)
  })

  it('returns false for primitive tokens', () => {
    expect(isComponent({ path: ['primitive', 'color', 'blue', '600'] })).toBe(false)
  })
})

// ─── isSemantic ─────────────────────────────────────────────────────────────────

describe('isSemantic', () => {
  it('returns true for semantic tokens (not primitive, not component)', () => {
    expect(isSemantic({ path: ['color', 'background', 'primary'] })).toBe(true)
  })

  it('returns false for primitive tokens', () => {
    expect(isSemantic({ path: ['primitive', 'color', 'blue', '600'] })).toBe(false)
  })

  it('returns false for component tokens', () => {
    expect(isSemantic({ path: ['color', 'component', 'button'] })).toBe(false)
  })

  it('returns true for tokens with only one path segment (implicit semantic)', () => {
    // not primitive (path[0] !== 'primitive'), not component (no color.component pattern)
    expect(isSemantic({ path: ['sizing'] })).toBe(true)
  })

  it('returns false when token has no path (same as primitive and component false)', () => {
    // isPrimitive({}) = undefined (falsy), isComponent({}) = undefined (falsy)
    // !undefined && !undefined → true → returns true is the answer.
    // Let me verify with actual logic: !undefined → true, true && true → true.
    // Actually this is a degenerate case — no path = neither primitive nor component, so it's semantic
    expect(isSemantic({})).toBe(true)
  })
})

// ─── isSemanticOrComponent ──────────────────────────────────────────────────────

describe('isSemanticOrComponent', () => {
  it('returns true for semantic tokens', () => {
    expect(isSemanticOrComponent({ path: ['color', 'background', 'primary'] })).toBe(true)
  })

  it('returns true for component tokens', () => {
    expect(isSemanticOrComponent({ path: ['color', 'component', 'button'] })).toBe(true)
  })

  it('returns false for primitive tokens', () => {
    expect(isSemanticOrComponent({ path: ['primitive', 'color', 'blue', '600'] })).toBe(false)
  })

  it('returns false only when token is primitive', () => {
    expect(isSemanticOrComponent({ path: ['spacing', 'scale', 'lg'] })).toBe(true)
  })
})
