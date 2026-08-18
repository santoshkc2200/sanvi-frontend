import { describe, expect, it } from 'vitest'
import { safeReturnTo } from '../src/return-to'

describe('safeReturnTo', () => {
  it('accepts an ordinary relative path', () => {
    expect(safeReturnTo('/members')).toBe('/members')
    expect(safeReturnTo('/members?tab=invited')).toBe('/members?tab=invited')
  })

  it('rejects a missing value', () => {
    expect(safeReturnTo(null)).toBeUndefined()
    expect(safeReturnTo(undefined)).toBeUndefined()
    expect(safeReturnTo('')).toBeUndefined()
  })

  it('rejects an absolute URL to another host', () => {
    expect(safeReturnTo('https://evil.example.com/phish')).toBeUndefined()
  })

  it('rejects a protocol-relative URL — browsers treat // as cross-origin regardless of path shape', () => {
    expect(safeReturnTo('//evil.example.com')).toBeUndefined()
  })

  it('rejects a backslash variant browsers also normalize to protocol-relative', () => {
    expect(safeReturnTo('/\\evil.example.com')).toBeUndefined()
  })

  it('rejects a bare path with no leading slash', () => {
    expect(safeReturnTo('members')).toBeUndefined()
  })
})
