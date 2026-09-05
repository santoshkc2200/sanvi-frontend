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

  it('does not mark conversion reported if reporter throws, allowing future retry (Defect 9)', () => {
    const failingReporter = vi.fn(() => {
      throw new Error('Adblock blocked request')
    })

    const result1 = recordConversionOnce('conv_failed', failingReporter)
    expect(result1).toBe(false)
    expect(failingReporter).toHaveBeenCalledTimes(1)

    // Second attempt with working reporter should succeed
    const successfulReporter = vi.fn()
    const result2 = recordConversionOnce('conv_failed', successfulReporter)
    expect(result2).toBe(true)
    expect(successfulReporter).toHaveBeenCalledWith('conv_failed')
  })

  it('guards in-flight conversions from duplicate execution (Defect 9)', async () => {
    let resolveReporter!: () => void
    const promise = new Promise<void>((resolve) => {
      resolveReporter = resolve
    })
    const asyncReporter = vi.fn(() => promise)

    const result1 = recordConversionOnce('conv_async', asyncReporter)
    expect(result1).toBe(true)
    expect(asyncReporter).toHaveBeenCalledTimes(1)

    // Concurrent second call while first is in-flight
    const result2 = recordConversionOnce('conv_async', asyncReporter)
    expect(result2).toBe(false)
    expect(asyncReporter).toHaveBeenCalledTimes(1)

    resolveReporter()
    await promise

    // Subsequent third call after completion
    const result3 = recordConversionOnce('conv_async', asyncReporter)
    expect(result3).toBe(false)
    expect(asyncReporter).toHaveBeenCalledTimes(1)
  })

  it('only resets conversion keys and preserves other sessionStorage keys (Defect 10)', () => {
    sessionStorage.setItem('sanvi_other_key', 'keep_me')
    recordConversionOnce('conv_test', () => {})

    expect(sessionStorage.getItem('sanvi_conversion_reported_conv_test')).toBe('1')
    expect(sessionStorage.getItem('sanvi_other_key')).toBe('keep_me')

    resetConversionTrackerForTesting()

    expect(sessionStorage.getItem('sanvi_conversion_reported_conv_test')).toBeNull()
    expect(sessionStorage.getItem('sanvi_other_key')).toBe('keep_me')
  })

  it('does not write storage marker or mark reported if reporter is undefined', () => {
    const result = recordConversionOnce('conv_no_reporter')
    expect(result).toBe(false)
    expect(sessionStorage.getItem('sanvi_conversion_reported_conv_no_reporter')).toBeNull()

    // Subsequent call with reporter should report successfully
    const reporter = vi.fn()
    const retryResult = recordConversionOnce('conv_no_reporter', reporter)
    expect(retryResult).toBe(true)
    expect(reporter).toHaveBeenCalledWith('conv_no_reporter')
    expect(sessionStorage.getItem('sanvi_conversion_reported_conv_no_reporter')).toBe('1')
  })
})
