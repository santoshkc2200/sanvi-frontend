import { describe, expect, it } from 'vitest'
import { shouldSample } from '../sampling'

describe('shouldSample', () => {
  it('rate 1 always samples, whatever the rng says', () => {
    expect(shouldSample(1, 0.999999)).toBe(true)
    expect(shouldSample(1, 0)).toBe(true)
  })

  it('rate 0 never samples', () => {
    expect(shouldSample(0, 0)).toBe(false)
  })

  it('a fractional rate admits exactly the rng draws below it', () => {
    expect(shouldSample(0.25, 0.24)).toBe(true)
    expect(shouldSample(0.25, 0.25)).toBe(false)
  })

  it('non-finite or negative rates fail closed — a nonsense rate never enables everything', () => {
    expect(shouldSample(Number.NaN, 0)).toBe(false)
    expect(shouldSample(-1, 0)).toBe(false)
    expect(shouldSample(Number.POSITIVE_INFINITY, 0)).toBe(false)
  })
})
