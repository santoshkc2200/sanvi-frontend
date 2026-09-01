import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pollPaymentConnection } from './poll'

describe('pollPaymentConnection', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('starts polling immediately and calls fetchFn', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ id: 'conn_1', status: 'onboarding' })
    const isDone = vi.fn().mockReturnValue(false)
    const onUpdate = vi.fn()

    const poller = pollPaymentConnection(fetchFn, isDone, {
      minDelayMs: 1000,
      jitterRatio: 0,
      onUpdate,
    })

    poller.start()
    expect(poller.isRunning()).toBe(true)

    await vi.advanceTimersByTimeAsync(0)
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(onUpdate).toHaveBeenCalledWith({ id: 'conn_1', status: 'onboarding' })

    poller.stop()
    expect(poller.isRunning()).toBe(false)
  })

  it('backs off polling interval exponentially on successive calls', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ id: 'conn_1', status: 'onboarding' })
    const isDone = vi.fn().mockReturnValue(false)

    const poller = pollPaymentConnection(fetchFn, isDone, {
      minDelayMs: 1000,
      backoffFactor: 2,
      maxDelayMs: 5000,
      jitterRatio: 0,
    })

    poller.start()
    // Initial fetch (t=0)
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchFn).toHaveBeenCalledTimes(1)

    // First interval: minDelayMs = 1000ms
    await vi.advanceTimersByTimeAsync(999)
    expect(fetchFn).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetchFn).toHaveBeenCalledTimes(2)

    // Second interval: 1000 * 2 = 2000ms
    await vi.advanceTimersByTimeAsync(1999)
    expect(fetchFn).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetchFn).toHaveBeenCalledTimes(3)

    // Third interval: 2000 * 2 = 4000ms
    await vi.advanceTimersByTimeAsync(3999)
    expect(fetchFn).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetchFn).toHaveBeenCalledTimes(4)

    poller.stop()
  })

  it('stops polling when isDone returns true (connection is active)', async () => {
    let callCount = 0
    const fetchFn = vi.fn().mockImplementation(async () => {
      callCount++
      if (callCount === 2) {
        return { id: 'conn_1', status: 'active', can_accept_payments: true }
      }
      return { id: 'conn_1', status: 'onboarding', can_accept_payments: false }
    })
    const isDone = vi.fn((res) => res.status === 'active')
    const onUpdate = vi.fn()

    const poller = pollPaymentConnection(fetchFn, isDone, {
      minDelayMs: 1000,
      jitterRatio: 0,
      onUpdate,
    })

    poller.start()
    // Initial poll
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(poller.isRunning()).toBe(true)

    // Next poll
    await vi.advanceTimersByTimeAsync(1000)
    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(poller.isRunning()).toBe(false)
    expect(poller.getCurrent()).toEqual({
      id: 'conn_1',
      status: 'active',
      can_accept_payments: true,
    })

    // Further time does not trigger more fetches
    await vi.advanceTimersByTimeAsync(10000)
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it('stops/pauses polling when tab is hidden and resumes when visible', async () => {
    let visibility = 'visible'
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    })

    const fetchFn = vi.fn().mockResolvedValue({ id: 'conn_1', status: 'onboarding' })
    const isDone = vi.fn().mockReturnValue(false)

    const poller = pollPaymentConnection(fetchFn, isDone, {
      minDelayMs: 1000,
      jitterRatio: 0,
    })

    poller.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchFn).toHaveBeenCalledTimes(1)

    // Tab becomes hidden before next interval
    visibility = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))

    // Time passes while tab is hidden — no poll should execute
    await vi.advanceTimersByTimeAsync(5000)
    expect(fetchFn).toHaveBeenCalledTimes(1)

    // Tab becomes visible again — poll resumes immediately
    visibility = 'visible'
    document.dispatchEvent(new Event('visibilitychange'))

    await vi.advanceTimersByTimeAsync(0)
    expect(fetchFn).toHaveBeenCalledTimes(2)

    poller.stop()
  })

  it('notifies state change during poll execution', async () => {
    let resolveFetch: ((value: unknown) => void) | undefined
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve
    })
    const fetchFn = vi.fn().mockReturnValue(fetchPromise)
    const isDone = vi.fn().mockReturnValue(false)
    const onPollStateChange = vi.fn()

    const poller = pollPaymentConnection(fetchFn, isDone, {
      minDelayMs: 1000,
      jitterRatio: 0,
      onPollStateChange,
    })

    poller.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(onPollStateChange).toHaveBeenCalledWith(true)

    resolveFetch?.({ id: 'conn_1', status: 'onboarding' })
    await vi.advanceTimersByTimeAsync(0)
    expect(onPollStateChange).toHaveBeenCalledWith(false)

    poller.stop()
  })
})
