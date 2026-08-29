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
})
