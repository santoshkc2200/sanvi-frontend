<script lang="ts">
import {
  loadStripe,
  type Stripe,
  type StripeElements,
  type StripePaymentElement,
} from '@stripe/stripe-js'
import { onMount } from 'svelte'
import type { PaymentMethodFormLabels } from './types'

export let clientSecret: string
export let publishableKey: string
export let returnUrl: string
export let onConfirmed: (setupIntentId: string) => void | Promise<void>
export let labels: PaymentMethodFormLabels

let mountNode: HTMLDivElement
let stripe: Stripe | null = null
let elements: StripeElements | null = null
let paymentElement: StripePaymentElement | null = null
let isReady = false
let isSubmitting = false
let error: string | null = null

const stripePromiseCache = new Map<string, ReturnType<typeof loadStripe>>()
function getStripe(key: string) {
  let promise = stripePromiseCache.get(key)
  if (!promise) {
    promise = loadStripe(key)
    stripePromiseCache.set(key, promise)
  }
  return promise
}

onMount(() => {
  let active = true
  void (async () => {
    try {
      stripe = await getStripe(publishableKey)
      if (!active || !stripe) throw new Error('Stripe.js failed to load')
      elements = stripe.elements({ clientSecret })
      paymentElement = elements.create('payment')
      paymentElement.mount(mountNode)
      isReady = true
    } catch (cause) {
      if (active) error = cause instanceof Error ? cause.message : labels.genericError
    }
  })()

  return () => {
    active = false
    paymentElement?.destroy()
  }
})

async function submit(): Promise<void> {
  if (!stripe || !elements || isSubmitting) return
  error = null
  isSubmitting = true
  try {
    const result = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: 'if_required',
    })
    if (result.error) {
      error = result.error.message ?? labels.genericError
      return
    }
    await onConfirmed(result.setupIntent.id)
  } catch {
    error = labels.genericError
  } finally {
    isSubmitting = false
  }
}
</script>

<div class="stripe-form">
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  <div bind:this={mountNode}></div>
  <button type="button" disabled={!isReady || isSubmitting} on:click={() => void submit()}>
    {isSubmitting ? labels.submitting : labels.submit}
  </button>
</div>

<style>
  .stripe-form { display: grid; gap: 1rem; }
  button { justify-self: start; padding: .625rem 1rem; color: white; background: #0f172a; border: 0; border-radius: .375rem; cursor: pointer; }
  button:disabled { opacity: .55; cursor: not-allowed; }
  .error { margin: 0; padding: .75rem; color: #b42318; background: #fef3f2; border-radius: .375rem; }
</style>
