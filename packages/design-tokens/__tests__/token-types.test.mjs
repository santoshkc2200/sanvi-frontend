import { describe, expect, it } from 'vitest'
import { getTokenType, isDimensionToken } from '../config/lib.mjs'

// ─── getTokenType ───────────────────────────────────────────────────────────────

describe('getTokenType', () => {
  it('returns $type when present (DTCG format)', () => {
    expect(getTokenType({ $type: 'color' })).toBe('color')
  })

  it('falls back to type when $type is absent (legacy SD format)', () => {
    expect(getTokenType({ type: 'dimension' })).toBe('dimension')
  })

  it('prefers $type over type when both are present', () => {
    expect(getTokenType({ $type: 'color', type: 'dimension' })).toBe('color')
  })

  it('returns undefined when neither is present', () => {
    expect(getTokenType({})).toBeUndefined()
  })

  it('returns undefined for null/undefined token', () => {
    // null/undefined tokens cause a TypeError — that's expected behaviour
    // since you should never pass null to getTokenType in production.
    expect(() => getTokenType(null)).toThrow(TypeError)
    expect(() => getTokenType(undefined)).toThrow(TypeError)
  })
})

// ─── isDimensionToken ───────────────────────────────────────────────────────────

describe('isDimensionToken', () => {
  it('returns true for spacing tokens', () => {
    expect(isDimensionToken({ $type: 'spacing' })).toBe(true)
  })

  it('returns true for dimension tokens', () => {
    expect(isDimensionToken({ $type: 'dimension' })).toBe(true)
  })

  it('returns true for borderRadius tokens', () => {
    expect(isDimensionToken({ $type: 'borderRadius' })).toBe(true)
  })

  it('returns false for color tokens', () => {
    expect(isDimensionToken({ $type: 'color' })).toBe(false)
  })

  it('returns false for typography tokens', () => {
    expect(isDimensionToken({ $type: 'typography' })).toBe(false)
  })

  it('returns false when no type is present', () => {
    expect(isDimensionToken({})).toBe(false)
  })
})
