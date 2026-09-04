<script lang="ts">
import { t } from '@sanvi/i18n'
import { apiClient } from '$lib/auth'
import {
  clearCart,
  CheckoutErrorView,
  ConfirmationView,
  ConfirmingState,
  pollCheckoutStatus,
  type CheckoutView,
} from '$lib/checkout'
import { clearIdempotencyKey, clearPendingCheckoutId } from '$lib/checkout/idempotency'
import { buildPurchaseBeacon, fireConversionBeacon } from '$lib/tracking/beacon'
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()

let checkoutState = $state<'confirming' | 'paid' | 'delayed' | 'failed' | 'canceled' | 'not_found'>(
  'confirming',
)
let isDelayed = $state(false)
let resolvedCheckout = $state<CheckoutView | null>(null)
let failureCode = $state<string | null>(null)

/**
 * The confirmation view calls this through `recordConversionOnce`, so it
 * runs exactly once per server-issued event id — a refresh fires no second
 * beacon. It only hands the payload to the fire-and-forget beacon sender:
 * nothing here is awaited on the render path.
 */
function reportPurchase(conversionEventId: string): void {
  if (!resolvedCheckout) return
  fireConversionBeacon(buildPurchaseBeacon(resolvedCheckout, conversionEventId))
}

$effect(() => {
  const checkoutId = data.checkoutId

  isDelayed = false
  failureCode = null
  resolvedCheckout = null

  if (!checkoutId) {
    checkoutState = 'not_found'
    clearPendingCheckoutId()
    return
  }

  checkoutState = 'confirming'

  let aborted = false
  const abortController = new AbortController()

  async function poll() {
    try {
      const result = await pollCheckoutStatus(apiClient, checkoutId!, {
        signal: abortController.signal,
        onDelayed: () => {
          if (!aborted) {
            isDelayed = true
          }
        },
      })

      if (aborted || abortController.signal.aborted) return

      resolvedCheckout = result

      if (result.status === 'paid') {
        checkoutState = 'paid'
        clearCart()
        clearPendingCheckoutId()
        clearIdempotencyKey()
      } else if (result.status === 'canceled') {
        checkoutState = 'canceled'
        failureCode = 'canceled'
        clearPendingCheckoutId()
        clearIdempotencyKey()
      } else if (result.status === 'expired') {
        checkoutState = 'failed'
        failureCode = 'expired'
        clearPendingCheckoutId()
        clearIdempotencyKey()
      } else if (result.status === 'failed') {
        checkoutState = 'failed'
        failureCode = 'generic'
        clearPendingCheckoutId()
        clearIdempotencyKey()
      } else {
        // Still pending after polling ceiling: hold confirming state with delayed reassurance notice.
        // Never render a false failure!
        checkoutState = 'delayed'
        isDelayed = true
      }
    } catch (err: unknown) {
      if (aborted || abortController.signal.aborted) return
      checkoutState = 'delayed'
      isDelayed = true
    }
  }

  void poll()

  return () => {
    aborted = true
    abortController.abort()
  }
})

const pageTitle = $derived.by(() => {
  if (checkoutState === 'paid') return t['storefront.checkout.confirmation.title']()
  if (checkoutState === 'canceled') return t['storefront.checkout.canceled.title']()
  if (checkoutState === 'not_found') return t['storefront.checkout.notFound.title']()
  if (checkoutState === 'failed') return t['storefront.checkout.error.title']()
  return t['storefront.checkout.confirming.title']()
})
</script>

<svelte:head>
  <title>{pageTitle}</title>
</svelte:head>

{#if checkoutState === 'not_found'}
  <CheckoutErrorView
    title={t['storefront.checkout.notFound.title']()}
    message={t['storefront.checkout.error.notFoundBody']()}
  />
{:else if checkoutState === 'canceled'}
  <CheckoutErrorView
    title={t['storefront.checkout.canceled.title']()}
    message={t['storefront.checkout.canceledNotice']()}
  />
{:else if checkoutState === 'confirming' || checkoutState === 'delayed'}
  <ConfirmingState delayed={isDelayed || checkoutState === 'delayed'} />
{:else if checkoutState === 'paid' && resolvedCheckout}
  <ConfirmationView checkout={resolvedCheckout} onConversionReported={reportPurchase} />
{:else}
  <CheckoutErrorView declineCode={failureCode} />
{/if}
