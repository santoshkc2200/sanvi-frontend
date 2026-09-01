<script lang="ts">
import { t } from '@sanvi/i18n'
import { apiClient } from '$lib/auth'
import {
  CheckoutErrorView,
  ConfirmationView,
  ConfirmingState,
  pollCheckoutStatus,
  type CheckoutView,
} from '$lib/checkout'
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()

let checkoutState = $state<'confirming' | 'paid' | 'delayed' | 'failed' | 'canceled' | 'not_found'>(
  'confirming',
)
let isDelayed = $state(false)
let resolvedCheckout = $state<CheckoutView | null>(null)
let failureCode = $state<string | null>(null)

$effect(() => {
  const checkoutId = data.checkoutId
  if (!checkoutId) {
    checkoutState = 'not_found'
    return
  }

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

      if (aborted) return

      resolvedCheckout = result

      if (result.status === 'paid') {
        checkoutState = 'paid'
      } else if (result.status === 'canceled') {
        checkoutState = 'canceled'
        failureCode = 'canceled'
      } else if (result.status === 'expired') {
        checkoutState = 'failed'
        failureCode = 'expired'
      } else if (result.status === 'failed') {
        checkoutState = 'failed'
        failureCode = 'card_declined'
      } else {
        // Still pending after polling ceiling: hold confirming state with delayed reassurance notice.
        // Never render a false failure!
        checkoutState = 'delayed'
        isDelayed = true
      }
    } catch (err: unknown) {
      if (aborted) return
      checkoutState = 'failed'
      failureCode = 'generic'
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
  if (checkoutState === 'failed' || checkoutState === 'not_found' || checkoutState === 'canceled') {
    return t['storefront.checkout.error.title']()
  }
  return t['storefront.checkout.confirming.title']()
})
</script>

<svelte:head>
  <title>{pageTitle}</title>
</svelte:head>

{#if checkoutState === 'not_found'}
  <CheckoutErrorView
    message={t['storefront.checkout.error.notFoundBody']()}
  />
{:else if checkoutState === 'confirming' || checkoutState === 'delayed'}
  <ConfirmingState delayed={isDelayed || checkoutState === 'delayed'} />
{:else if checkoutState === 'paid' && resolvedCheckout}
  <ConfirmationView checkout={resolvedCheckout} />
{:else}
  <CheckoutErrorView declineCode={failureCode} />
{/if}
