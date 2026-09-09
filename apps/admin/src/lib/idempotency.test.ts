import { describe, expect, it } from 'vitest'
import { ActionKeyTracker, isDefinitiveError, mintIdempotencyKey } from './idempotency'

describe('mintIdempotencyKey', () => {
  it('returns a valid UUID v4 format string', () => {
    const key = mintIdempotencyKey()
    expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  })

  it('mints unique keys on repeated calls', () => {
    const keys = new Set<string>()
    for (let i = 0; i < 50; i++) {
      keys.add(mintIdempotencyKey())
    }
    expect(keys.size).toBe(50)
  })
})

describe('isDefinitiveError', () => {
  it('classifies 400, 401, 403, 404, 409, 422 as definitive failures', () => {
    for (const status of [400, 401, 403, 404, 409, 422]) {
      expect(isDefinitiveError({ status })).toBe(true)
    }
  })

  it('classifies network errors and server errors as non-definitive failures', () => {
    expect(isDefinitiveError(new Error('Network failure'))).toBe(false)
    expect(isDefinitiveError({ status: 500 })).toBe(false)
    expect(isDefinitiveError({ status: 502 })).toBe(false)
    expect(isDefinitiveError({ status: 503 })).toBe(false)
    expect(isDefinitiveError({ status: 504 })).toBe(false)
    expect(isDefinitiveError({ status: 429 })).toBe(false)
    expect(isDefinitiveError({ status: 408 })).toBe(false)
  })
})

describe('ActionKeyTracker', () => {
  it('mints and reuses the same key for the same (targetId, action) attempt', () => {
    const tracker = new ActionKeyTracker()
    const key1 = tracker.getOrMint('camp_123', 'publish')
    expect(key1).toBeDefined()

    // Retry must reuse the key
    const key2 = tracker.getOrMint('camp_123', 'publish')
    expect(key2).toBe(key1)

    // Different action gets its own key
    const pauseKey = tracker.getOrMint('camp_123', 'pause')
    expect(pauseKey).not.toBe(key1)

    // Different target gets its own key
    const otherKey = tracker.getOrMint('camp_456', 'publish')
    expect(otherKey).not.toBe(key1)
  })

  it('clears key on success and mints fresh key on next attempt', () => {
    const tracker = new ActionKeyTracker()
    const key1 = tracker.getOrMint('camp_1', 'resume')
    tracker.handleOutcome('camp_1', 'resume') // success

    const key2 = tracker.getOrMint('camp_1', 'resume')
    expect(key2).not.toBe(key1)
  })

  it('preserves key on non-definitive errors like 503 or network timeout', () => {
    const tracker = new ActionKeyTracker()
    const key1 = tracker.getOrMint('camp_1', 'publish')

    // 503 Platform Unavailable
    tracker.handleOutcome('camp_1', 'publish', { status: 503 })
    expect(tracker.getKey('camp_1', 'publish')).toBe(key1)

    // Network timeout Error
    tracker.handleOutcome('camp_1', 'publish', new Error('Timeout'))
    expect(tracker.getKey('camp_1', 'publish')).toBe(key1)
  })

  it('clears key on definitive error like 400 validation rejection', () => {
    const tracker = new ActionKeyTracker()
    const key1 = tracker.getOrMint('camp_1', 'publish')
    expect(key1).toBeDefined()

    tracker.handleOutcome('camp_1', 'publish', { status: 400 })
    expect(tracker.getKey('camp_1', 'publish')).toBeUndefined()
  })
})
