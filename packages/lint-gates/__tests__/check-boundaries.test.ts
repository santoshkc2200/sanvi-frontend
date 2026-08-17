import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { checkWorkspace } from '../src/check-boundaries.mjs'

const FIXTURES = fileURLToPath(new URL('../__fixtures__/', import.meta.url))

describe('check:boundaries gate', () => {
  it('fails on its violation fixture — a lint nobody has seen fail is a lint nobody trusts', () => {
    const violations = checkWorkspace(`${FIXTURES}boundaries-violation`)
    expect(violations.length).toBe(3)
  })

  it('catches ui importing api-client', () => {
    const violations = checkWorkspace(`${FIXTURES}boundaries-violation`)
    expect(
      violations.some((v) => v.file.includes('/ui/src/') && v.specifier === '@sanvi/api-client'),
    ).toBe(true)
  })

  it('catches one app importing another', () => {
    const violations = checkWorkspace(`${FIXTURES}boundaries-violation`)
    expect(violations.some((v) => v.specifier === '@sanvi/storefront')).toBe(true)
  })

  it('catches a deep import into another package src', () => {
    const violations = checkWorkspace(`${FIXTURES}boundaries-violation`)
    expect(violations.some((v) => v.specifier === '@sanvi/ui/src/Button.svelte')).toBe(true)
  })

  it('passes on its clean fixture', () => {
    const violations = checkWorkspace(`${FIXTURES}boundaries-clean`)
    expect(violations).toEqual([])
  })
})
