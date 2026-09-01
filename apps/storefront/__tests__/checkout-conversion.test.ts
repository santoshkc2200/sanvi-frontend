import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  recordConversionOnce,
  resetConversionTrackerForTesting,
} from '../src/lib/checkout/conversion'

describe('recordConversionOnce', () => {
  beforeEach(() => {
    resetConversionTrackerForTesting()
    sessionStorage.clear()
  })

  it('records conversion event once and calls reporter', () => {
    const reporter = vi.fn()
    const result1 = recordConversionOnce('conv_123', reporter)

    expect(result1).toBe(true)
    expect(reporter).toHaveBeenCalledWith('conv_123')
    expect(reporter).toHaveBeenCalledTimes(1)

    // Second attempt with same ID (e.g. page refresh)
    const result2 = recordConversionOnce('conv_123', reporter)
    expect(result2).toBe(false)
    expect(reporter).toHaveBeenCalledTimes(1)
  })

  it('returns false for undefined or empty conversion IDs', () => {
    const reporter = vi.fn()
    expect(recordConversionOnce(undefined, reporter)).toBe(false)
    expect(recordConversionOnce(null, reporter)).toBe(false)
    expect(recordConversionOnce('', reporter)).toBe(false)
    expect(reporter).not.toHaveBeenCalled()
  })

  it('handles distinct conversion IDs independently', () => {
    const reporter = vi.fn()
    expect(recordConversionOnce('conv_A', reporter)).toBe(true)
    expect(recordConversionOnce('conv_B', reporter)).toBe(true)
    expect(recordConversionOnce('conv_A', reporter)).toBe(false)
    expect(reporter).toHaveBeenCalledTimes(2)
  })
})
