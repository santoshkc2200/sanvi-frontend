import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pollWithBackoff } from './poll'

describe('pollWithBackoff helper', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls fetch function and stops when isDone returns true', async () => {
    let callCount = 0
    const mockFetch = vi.fn(async () => {
      callCount++
      return { status: callCount >= 3 ? 'live' : 'verifying' }
    })
    const isDone = vi.fn((res: { status: string }) => res.status === 'live')
    const onUpdate = vi.fn()

    const poller = pollWithBackoff(mockFetch, isDone, {
      minDelayMs: 100,
      maxDelayMs: 1000,
      backoffFactor: 2,
      jitterRatio: 0,
      onUpdate,
    })

    poller.start()
    expect(poller.isRunning()).toBe(true)

    // First call happens immediately
    await vi.advanceTimersByTimeAsync(10)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(isDone).toHaveBeenCalledWith({ status: 'verifying' })

    // Second call after minDelayMs (100ms)
    await vi.advanceTimersByTimeAsync(100)
    expect(mockFetch).toHaveBeenCalledTimes(2)

    // Third call after 200ms (100 * 2)
    await vi.advanceTimersByTimeAsync(200)
    expect(mockFetch).toHaveBeenCalledTimes(3)
    expect(isDone).toHaveBeenCalledWith({ status: 'live' })
    expect(poller.isRunning()).toBe(false)
    expect(poller.getCurrent()).toEqual({ status: 'live' })

    // Advancing further should not trigger more calls
    await vi.advanceTimersByTimeAsync(1000)
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('can be manually cancelled with stop()', async () => {
    const mockFetch = vi.fn(async () => ({ status: 'verifying' }))
    const isDone = vi.fn(() => false)

    const poller = pollWithBackoff(mockFetch, isDone, {
      minDelayMs: 100,
      maxDelayMs: 1000,
      jitterRatio: 0,
    })

    poller.start()
    await vi.advanceTimersByTimeAsync(10)
    expect(mockFetch).toHaveBeenCalledTimes(1)

    poller.stop()
    expect(poller.isRunning()).toBe(false)

    await vi.advanceTimersByTimeAsync(500)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('supports checkNow with minimum interval rate limiting', async () => {
    let count = 0
    const mockFetch = vi.fn(async () => {
      count++
      return { count }
    })
    const isDone = vi.fn(() => false)

    const poller = pollWithBackoff(mockFetch, isDone, {
      minDelayMs: 200,
      maxDelayMs: 2000,
      jitterRatio: 0,
    })

    poller.start()
    await vi.advanceTimersByTimeAsync(10)
    expect(mockFetch).toHaveBeenCalledTimes(1)

    // checkNow called after 50ms should wait until 200ms elapsed
    const checkPromise = poller.checkNow()
    await vi.advanceTimersByTimeAsync(50)
    expect(mockFetch).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(150)
    await checkPromise
    expect(mockFetch).toHaveBeenCalledTimes(2)
    poller.stop()
  })

  it('does not revive a stopped poller from checkNow', async () => {
    const mockFetch = vi.fn(async () => ({ status: 'live' }))
    const poller = pollWithBackoff(mockFetch, () => true, {
      minDelayMs: 100,
      maxDelayMs: 1000,
      jitterRatio: 0,
    })

    poller.start()
    await vi.advanceTimersByTimeAsync(10)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(poller.isRunning()).toBe(false)

    await expect(poller.checkNow()).resolves.toEqual({ status: 'live' })
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(poller.isRunning()).toBe(false)

    await vi.advanceTimersByTimeAsync(2000)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('resets the backoff after a manual check', async () => {
    const firedAt: number[] = []
    const mockFetch = vi.fn(async () => {
      firedAt.push(Date.now())
      return { status: 'verifying' }
    })
    const poller = pollWithBackoff(mockFetch, () => false, {
      minDelayMs: 100,
      maxDelayMs: 10000,
      backoffFactor: 10,
      jitterRatio: 0,
    })

    poller.start()
    // Two automatic ticks: gaps of 100ms then 1000ms, leaving the backoff at 10000ms.
    await vi.advanceTimersByTimeAsync(1200)

    const checkPromise = poller.checkNow()
    await vi.advanceTimersByTimeAsync(200)
    await checkPromise
    await vi.advanceTimersByTimeAsync(1500)
    poller.stop()

    const gaps = firedAt.slice(1).map((at, i) => at - (firedAt[i] ?? 0))
    // The manual check restarts the backoff, so the ticks around it are
    // minDelayMs apart again instead of resuming the grown 10000ms interval.
    expect(gaps.slice(0, 5)).toEqual([100, 1000, 100, 100, 1000])
  })

  it('keeps jittered delays within one backoff step', async () => {
    const firedAt: number[] = []
    const mockFetch = vi.fn(async () => {
      firedAt.push(Date.now())
      return { status: 'verifying' }
    })
    const poller = pollWithBackoff(mockFetch, () => false, {
      minDelayMs: 100,
      maxDelayMs: 1000,
      backoffFactor: 1,
      jitterRatio: 0.5,
    })

    poller.start()
    await vi.advanceTimersByTimeAsync(1000)
    poller.stop()

    expect(firedAt.length).toBeGreaterThan(2)
    for (let i = 1; i < firedAt.length; i++) {
      const gap = (firedAt[i] ?? 0) - (firedAt[i - 1] ?? 0)
      expect(gap).toBeGreaterThanOrEqual(100)
      expect(gap).toBeLessThanOrEqual(150)
    }
  })

  it('handles fetch errors without crashing and continues polling with backoff', async () => {
    let callIndex = 0
    const onError = vi.fn()
    const mockFetch = vi.fn(async () => {
      callIndex++
      if (callIndex === 1) {
        throw new Error('Network error')
      }
      return { status: 'live' }
    })
    const isDone = vi.fn((res: { status: string }) => res.status === 'live')

    const poller = pollWithBackoff(mockFetch, isDone, {
      minDelayMs: 100,
      maxDelayMs: 1000,
      backoffFactor: 2,
      jitterRatio: 0,
      onError,
    })

    poller.start()
    await vi.advanceTimersByTimeAsync(10)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(200)
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(poller.isRunning()).toBe(false)
  })

  it('stops and reports stalled after stallTimeoutMs with no change in polled result', async () => {
    const mockFetch = vi.fn(async () => ({ status: 'verifying' }))
    const onStalled = vi.fn()
    const onUpdate = vi.fn()

    const poller = pollWithBackoff(mockFetch, () => false, {
      minDelayMs: 100,
      maxDelayMs: 200,
      backoffFactor: 1.5,
      jitterRatio: 0,
      stallTimeoutMs: 1000,
      onStalled,
      onUpdate,
    })

    poller.start()
    expect(poller.isRunning()).toBe(true)
    expect(poller.isStalled()).toBe(false)

    // Advance 500ms: still running and polling
    await vi.advanceTimersByTimeAsync(500)
    expect(poller.isRunning()).toBe(true)
    expect(poller.isStalled()).toBe(false)
    expect(onStalled).not.toHaveBeenCalled()

    // Advance past stallTimeoutMs (1000ms total)
    await vi.advanceTimersByTimeAsync(600)
    expect(poller.isRunning()).toBe(false)
    expect(poller.isStalled()).toBe(true)
    expect(onStalled).toHaveBeenCalledWith({ status: 'verifying' })

    const countWhenStalled = mockFetch.mock.calls.length

    // Polling has stopped, advancing time produces no more calls
    await vi.advanceTimersByTimeAsync(1000)
    expect(mockFetch).toHaveBeenCalledTimes(countWhenStalled)
  })

  it('resets stall timer when the polled result changes', async () => {
    let callIndex = 0
    const mockFetch = vi.fn(async () => {
      callIndex++
      // Value changes at t=400ms (call 3)
      return { step: callIndex <= 2 ? 1 : 2 }
    })
    const onStalled = vi.fn()

    const poller = pollWithBackoff(mockFetch, () => false, {
      minDelayMs: 100,
      maxDelayMs: 100,
      jitterRatio: 0,
      stallTimeoutMs: 300,
      onStalled,
    })

    poller.start()
    // t=0 (call 1, step 1)
    await vi.advanceTimersByTimeAsync(10)
    // t=100 (call 2, step 1)
    await vi.advanceTimersByTimeAsync(100)
    // t=200 (call 3, step 2 - changed! stall timer resets to t=200)
    await vi.advanceTimersByTimeAsync(100)
    expect(poller.isRunning()).toBe(true)
    expect(poller.isStalled()).toBe(false)

    // At t=400ms (200ms after step 2 change), still under 300ms stallTimeout
    await vi.advanceTimersByTimeAsync(200)
    expect(poller.isRunning()).toBe(true)
    expect(poller.isStalled()).toBe(false)

    // At t=550ms (350ms after step 2 change), stall timeout exceeded
    await vi.advanceTimersByTimeAsync(150)
    expect(poller.isRunning()).toBe(false)
    expect(poller.isStalled()).toBe(true)
    expect(onStalled).toHaveBeenCalledWith({ step: 2 })
  })

  it('can resume polling via checkNow or start after stalling', async () => {
    let callCount = 0
    const mockFetch = vi.fn(async () => {
      callCount++
      return { count: callCount }
    })
    const poller = pollWithBackoff(mockFetch, () => false, {
      minDelayMs: 50,
      maxDelayMs: 50,
      jitterRatio: 0,
      stallTimeoutMs: 100,
      hasChanged: () => false, // simulate unchanged result
    })

    poller.start()
    await vi.advanceTimersByTimeAsync(150)
    expect(poller.isStalled()).toBe(true)

    // checkNow resets stalled state and triggers fetch
    await poller.checkNow()
    expect(poller.isStalled()).toBe(false)
    expect(poller.isRunning()).toBe(true)
    poller.stop()
  })
})
