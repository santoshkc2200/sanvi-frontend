import {
  ApiError,
  getTenantCheckout,
  type CheckoutView,
  type TypedApiClient,
} from '@sanvi/api-client'

export interface PollCheckoutOptions {
  maxAttempts?: number
  initialDelayMs?: number
  maxDelayMs?: number
  backoffFactor?: number
  delayedThresholdAttempts?: number
  onDelayed?: () => void
  signal?: AbortSignal
  sleep?: (ms: number) => Promise<void>
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Polls `GET /api/v1/tenant/checkout/{id}` with exponential backoff.
 *
 * Invariant: The webhook is the fact, the redirect is a hint.
 * Webhook lag must hold the confirming state and must never render a false failure.
 * When the polling ceiling is reached while still pending, the function returns
 * the checkout view in `pending` status so the UI can show the delayed reassurance
 * message ("taking longer than usual, we'll email you") rather than a false "payment failed".
 */
export async function pollCheckoutStatus(
  client: TypedApiClient,
  checkoutId: string,
  options: PollCheckoutOptions = {},
): Promise<CheckoutView> {
  const {
    maxAttempts = 15,
    initialDelayMs = 1000,
    maxDelayMs = 5000,
    backoffFactor = 1.5,
    delayedThresholdAttempts = 5,
    onDelayed,
    signal,
    sleep = defaultSleep,
  } = options

  let currentDelay = initialDelayMs
  let attempt = 0
  let delayedNotified = false

  while (attempt < maxAttempts) {
    if (signal?.aborted) {
      throw new Error('Polling aborted')
    }

    let checkout: CheckoutView | null = null
    try {
      checkout = await getTenantCheckout(client, checkoutId, signal)
    } catch (err) {
      if (signal?.aborted) throw err
      if (err instanceof ApiError && !err.isRetryable) {
        throw err
      }
      // A transient network/fetch error is not proof of payment failure — the webhook
      // is the fact, a failed status request is neither the webhook nor the redirect.
      // Treat it like a still-pending poll and keep retrying rather than surfacing a
      // false "payment failed" to a customer whose money may already have left.
      attempt += 1
      if (attempt >= delayedThresholdAttempts && !delayedNotified) {
        delayedNotified = true
        onDelayed?.()
      }
      if (attempt >= maxAttempts) {
        throw err
      }
      await sleep(currentDelay)
      currentDelay = Math.min(maxDelayMs, currentDelay * backoffFactor)
      continue
    }
    attempt += 1

    // Terminal states: resolve immediately
    if (checkout.status !== 'pending') {
      return checkout
    }

    // After threshold attempts, notify that confirmation is taking longer than usual
    if (attempt >= delayedThresholdAttempts && !delayedNotified) {
      delayedNotified = true
      onDelayed?.()
    }

    // Ceiling reached: return the pending checkout view (never throw or fail falsely)
    if (attempt >= maxAttempts) {
      return checkout
    }

    await sleep(currentDelay)
    currentDelay = Math.min(maxDelayMs, currentDelay * backoffFactor)
  }

  // Safety fallback in case maxAttempts <= 0
  return getTenantCheckout(client, checkoutId, signal)
}
