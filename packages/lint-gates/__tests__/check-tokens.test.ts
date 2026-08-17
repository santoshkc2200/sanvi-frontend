import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { checkDirectory } from '../src/check-tokens.mjs'

const FIXTURES = fileURLToPath(new URL('../__fixtures__/', import.meta.url))

describe('check:tokens gate', () => {
  it('fails on its violation fixture', () => {
    const violations = checkDirectory(`${FIXTURES}tokens-violation`)
    expect(violations.length).toBeGreaterThan(0)
  })

  it('flags the raw hex color and the two raw lengths', () => {
    const violations = checkDirectory(`${FIXTURES}tokens-violation`)
    const snippets = violations.map((v) => v.snippet)
    expect(snippets).toContain('background: #2563eb')
    expect(snippets).toContain('padding: 12px')
    expect(snippets).toContain('border-radius: 6px')
  })

  it('passes on its clean fixture — token references, allowed 1px, and the ignore comment', () => {
    const violations = checkDirectory(`${FIXTURES}tokens-clean`)
    expect(violations).toEqual([])
  })
})
