import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@sanvi/api-client'
import { pollCheckoutStatus } from '../src/lib/checkout/poll'
import type { CheckoutView } from '../src/lib/checkout/types'

function mockClient(views: CheckoutView[]) {
  let callIndex = 0
  const getFn = vi.fn(async () => {
    const view = views[Math.min(callIndex, views.length - 1)]
    callIndex += 1
    return view
  })

  return {
    client: {
      GET: getFn,
    } as never,
    getFn,
  }
}

describe('pollCheckoutStatus', () => {
  const pendingView: CheckoutView = {
    id: 'chk_123',
    amount_minor: 2000,
    currency: 'JPY',
    reference: 'ref_123',
    status: 'pending',
    created_at: new Date().toISOString(),
  }

  const paidView: CheckoutView = {
    ...pendingView,
    status: 'paid',
    conversion_event_id: 'conv_456',
  }

  const failedView: CheckoutView = {
    ...pendingView,
    status: 'failed',
  }

  it('resolves immediately when already paid on first poll', async () => {
    const { client, getFn } = mockClient([paidView])
    const sleep = vi.fn(async () => {})

    const result = await pollCheckoutStatus(client, 'chk_123', { sleep })

    expect(result.status).toBe('paid')
    expect(getFn).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it('polls with backoff while pending until paid', async () => {
    const { client, getFn } = mockClient([pendingView, pendingView, paidView])
    const sleep = vi.fn(async () => {})

    const result = await pollCheckoutStatus(client, 'chk_123', {
      initialDelayMs: 100,
      backoffFactor: 2,
      sleep,
    })

    expect(result.status).toBe('paid')
    expect(getFn).toHaveBeenCalledTimes(3)
    expect(sleep).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenNthCalledWith(1, 100)
    expect(sleep).toHaveBeenNthCalledWith(2, 200)
  })

  it('returns terminal failed status immediately when failed', async () => {
    const { client, getFn } = mockClient([pendingView, failedView])
    const sleep = vi.fn(async () => {})

    const result = await pollCheckoutStatus(client, 'chk_123', { sleep })

    expect(result.status).toBe('failed')
    expect(getFn).toHaveBeenCalledTimes(2)
  })

  it('triggers onDelayed when threshold attempts are reached while still pending', async () => {
    const { client } = mockClient([pendingView, pendingView, pendingView, pendingView])
    const sleep = vi.fn(async () => {})
    const onDelayed = vi.fn()

    await pollCheckoutStatus(client, 'chk_123', {
      maxAttempts: 4,
      delayedThresholdAttempts: 2,
      onDelayed,
      sleep,
    })

    expect(onDelayed).toHaveBeenCalledTimes(1)
  })

  it('holds pending state when ceiling is reached and NEVER returns a false failure', async () => {
    const { client, getFn } = mockClient([pendingView])
    const sleep = vi.fn(async () => {})

    const result = await pollCheckoutStatus(client, 'chk_123', {
      maxAttempts: 3,
      sleep,
    })

    // Webhook-delay resilience: must return pending status so UI shows delayed reassurance
    expect(result.status).toBe('pending')
    expect(getFn).toHaveBeenCalledTimes(3)
  })

  it('retries past a transient network error instead of surfacing a false failure', async () => {
    let callIndex = 0
    const getFn = vi.fn(async () => {
      callIndex += 1
      if (callIndex === 1) {
        throw new TypeError('Failed to fetch')
      }
      return paidView
    })
    const sleep = vi.fn(async () => {})

    const result = await pollCheckoutStatus({ GET: getFn } as never, 'chk_123', { sleep })

    expect(result.status).toBe('paid')
    expect(getFn).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledTimes(1)
  })

  it('holds pending (never a false failure) when a network error hits mid-poll before the ceiling', async () => {
    let callIndex = 0
    const getFn = vi.fn(async () => {
      callIndex += 1
      if (callIndex === 2) {
        throw new TypeError('Failed to fetch')
      }
      return pendingView
    })
    const sleep = vi.fn(async () => {})

    const result = await pollCheckoutStatus({ GET: getFn } as never, 'chk_123', {
      maxAttempts: 4,
      sleep,
    })

    expect(result.status).toBe('pending')
    expect(getFn).toHaveBeenCalledTimes(4)
  })

  it('only rejects after network errors persist through the entire ceiling', async () => {
    const getFn = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    const sleep = vi.fn(async () => {})

    await expect(
      pollCheckoutStatus({ GET: getFn } as never, 'chk_123', {
        maxAttempts: 3,
        sleep,
      }),
    ).rejects.toThrow('Failed to fetch')
    expect(getFn).toHaveBeenCalledTimes(3)
  })

  it('aborts when signal is aborted', async () => {
    const { client } = mockClient([pendingView])
    const abortController = new AbortController()
    abortController.abort()

    await expect(
      pollCheckoutStatus(client, 'chk_123', {
        signal: abortController.signal,
      }),
    ).rejects.toThrow('Polling aborted')
  })

  it('stops immediately and throws on non-retryable ApiError (e.g. 404)', async () => {
    const apiError = new ApiError(
      404,
      {
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
      },
      undefined,
    )

    const getFn = vi.fn(async () => {
      throw apiError
    })
    const sleep = vi.fn(async () => {})

    await expect(
      pollCheckoutStatus({ GET: getFn } as never, 'chk_123', {
        maxAttempts: 5,
        sleep,
      }),
    ).rejects.toThrow(apiError)

    expect(getFn).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })
})
