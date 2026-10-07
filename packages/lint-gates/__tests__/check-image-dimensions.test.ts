import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { findMissingDimensionsInDir } from '../src/check-image-dimensions.mjs'

const FIXTURES = fileURLToPath(new URL('../__fixtures__/image-dimensions/', import.meta.url))

describe('check:images — explicit dimensions on every img/iframe/embed', () => {
  it('flags dimensionless images, including multiline tags — a lint nobody has seen fail is a lint nobody trusts', () => {
    const violations = findMissingDimensionsInDir(`${FIXTURES}violation`)
    expect(violations).toHaveLength(2)
    expect(violations.every((v) => v.tag === 'img')).toBe(true)
    expect(violations[0].missing).toEqual(['width', 'height'])
  })

  it('passes explicit attrs, Svelte shorthand attrs, dimensioned iframes, and visible suppressions', () => {
    expect(findMissingDimensionsInDir(`${FIXTURES}clean`)).toEqual([])
  })
})
