import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { checkDirectory } from '../src/check-i18n.mjs'

const FIXTURES = fileURLToPath(new URL('../__fixtures__/', import.meta.url))

describe('check:i18n gate', () => {
  it('fails on its violation fixture — a lint nobody has seen fail is a lint nobody trusts', () => {
    const violations = checkDirectory(`${FIXTURES}i18n-violation`)
    expect(violations.length).toBeGreaterThan(0)
  })

  it('flags the hardcoded aria-label and the two hardcoded text runs', () => {
    const violations = checkDirectory(`${FIXTURES}i18n-violation`)
    const snippets = violations.map((v) => v.snippet)
    expect(snippets).toContain('aria-label="Increment counter"')
    expect(snippets.some((s) => s.includes('Click me'))).toBe(true)
  })

  it('passes on its clean fixture — prop-driven labels and the ignore comment', () => {
    const violations = checkDirectory(`${FIXTURES}i18n-clean`)
    expect(violations).toEqual([])
  })
})
