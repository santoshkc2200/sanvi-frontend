<script lang="ts">
import { fmt, t } from '@sanvi/i18n'
import { Alert, Button, Container, Stack } from '@sanvi/ui'
import { ApiError, createTenantCheckout } from '@sanvi/api-client'
import { apiClient } from '$lib/auth'
import { localePath } from '$lib/links'
import { calculateCartTotal, DEFAULT_SAMPLE_ITEMS, getCartContext } from './cart.svelte'
import { getOrCreateCheckoutSession, setPendingCheckoutId } from './idempotency'
import type { OrderItem } from './types'

interface Props {
  items?: OrderItem[]
  /** The connected account's settlement currency, from the server's
   *  checkout config. Absent means it could not be read — the storefront
   *  never guesses one, because the backend refuses any currency but the
   *  account's own and a guess would price the cart wrongly on the way. */
  currency?: string
  canAcceptPayments?: boolean
  cannotAcceptReason?: string
  canceled?: boolean
  reference?: string
  /** Whether a checkout started now would carry automatic tax, from the
   *  server's checkout config. Decides which tax note the buyer reads.
   *  Defaults to the "taxes may apply" hedge rather than the definite
   *  "taxes are not collected", so an unread config never states
   *  something false — and the note only renders alongside a known
   *  currency, which comes from the same config. */
  taxEnabled?: boolean
  onInitiateCheckout?: (idempotencyKey: string) => Promise<void> | void
}

let {
  items,
  currency,
  canAcceptPayments = true,
  cannotAcceptReason,
  canceled = false,
  reference: explicitReference,
  taxEnabled = true,
  onInitiateCheckout,
}: Props = $props()

const cart = getCartContext()
const effectiveItems = $derived(items ?? cart?.items ?? DEFAULT_SAMPLE_ITEMS)

let isSubmitting = $state(false)
let errorMessage = $state<string | null>(null)
// svelte-ignore state_referenced_locally
let liveCanAcceptPayments = $state(canAcceptPayments)

$effect(() => {
  liveCanAcceptPayments = canAcceptPayments
})

const subtotal = $derived(calculateCartTotal(effectiveItems))
const total = $derived(subtotal)
// Not knowing the currency is indistinguishable, for the buyer, from not
// being able to pay: there is nothing safe to render or send.
const canPay = $derived(liveCanAcceptPayments && currency !== undefined)
const effectiveCannotAcceptReason = $derived(
  cannotAcceptReason ?? t['storefront.checkout.payButtonDisabledReason'](),
)

async function handleCheckout() {
  if (!canPay || currency === undefined || isSubmitting) return

  isSubmitting = true
  errorMessage = null
  let navigated = false

  try {
    const payloadSignature = JSON.stringify({
      amount: total,
      currency,
      items: effectiveItems.map((it) => ({ id: it.id, qty: it.quantity, amount: it.amount_minor })),
      ...(explicitReference ? { reference: explicitReference } : {}),
    })

    const session = getOrCreateCheckoutSession(payloadSignature, explicitReference)
    const idempotencyKey = session.idempotencyKey
    const reference = session.reference

    if (onInitiateCheckout) {
      await onInitiateCheckout(idempotencyKey)
      return
    }

    const success_url = `${window.location.origin}${localePath('/checkout/return')}`
    const cancel_url = `${window.location.origin}${localePath('/checkout/cancel')}`

    const checkout = await createTenantCheckout(
      apiClient,
      {
        amount_minor: total,
        currency,
        reference,
        success_url,
        cancel_url,
      },
      idempotencyKey,
    )

    setPendingCheckoutId(checkout.id)

    if (checkout.url) {
      navigated = true
      window.location.href = checkout.url
    } else {
      errorMessage = t['storefront.checkout.error.generic']()
    }
  } catch (err: unknown) {
    if (
      (err instanceof ApiError && err.type === 'payments/provider-unavailable') ||
      (err as { type?: string })?.type === 'payments/provider-unavailable'
    ) {
      errorMessage = t['storefront.checkout.error.providerUnavailable']()
    } else if (
      (err instanceof ApiError && err.status === 409) ||
      (err as { status?: number })?.status === 409
    ) {
      liveCanAcceptPayments = false
      errorMessage = effectiveCannotAcceptReason
    } else {
      errorMessage = t['storefront.checkout.error.generic']()
    }
  } finally {
    if (!navigated) {
      isSubmitting = false
    }
  }
}
</script>

<Container size="md" padding="6">
  <Stack gap="6">
    <header class="sanvi-checkout-header">
      <h1 class="sanvi-checkout-title">{t['storefront.checkout.title']()}</h1>
    </header>

    {#if canceled}
      <Alert variant="info">
        <p>{t['storefront.checkout.canceledNotice']()}</p>
      </Alert>
    {/if}

    {#if errorMessage}
      <Alert variant="error">
        <p>{errorMessage}</p>
      </Alert>
    {/if}

    {#if !canPay}
      <Alert variant="warning">
        <p>{effectiveCannotAcceptReason}</p>
      </Alert>
    {/if}

    {#if effectiveItems.length === 0}
      <p class="sanvi-checkout-empty">{t['storefront.checkout.emptyCart']()}</p>
    {:else}
      <!-- Without the account's settlement currency there is nothing safe
           to price the cart in: the warning above says so, and the button
           below stays disabled. Prices in a guessed currency would be
           worse than no prices. -->
      {#if currency !== undefined}
      <div class="sanvi-checkout-items" role="region" aria-label={t['storefront.checkout.title']()}>
        <table class="sanvi-checkout-table">
          <thead>
            <tr>
              <th scope="col" class="sanvi-checkout-th-item">{t['storefront.checkout.item']()}</th>
              <th scope="col" class="sanvi-checkout-th-qty">{t['storefront.checkout.quantity']()}</th>
              <th scope="col" class="sanvi-checkout-th-price">{t['storefront.checkout.price']()}</th>
            </tr>
          </thead>
          <tbody>
            {#each effectiveItems as item (item.id)}
              <tr class="sanvi-checkout-row">
                <td class="sanvi-checkout-td-item">
                  <div class="sanvi-item-name">{item.name}</div>
                  {#if item.description}
                    <div class="sanvi-item-desc">{item.description}</div>
                  {/if}
                </td>
                <td class="sanvi-checkout-td-qty">{item.quantity}</td>
                <td class="sanvi-checkout-td-price">{fmt.money(item.amount_minor * item.quantity, currency)}</td>
              </tr>
            {/each}
          </tbody>
          <tfoot>
            <tr class="sanvi-checkout-subtotal-row">
              <td colspan={2} class="sanvi-checkout-label">{t['storefront.checkout.subtotal']()}</td>
              <td class="sanvi-checkout-value">{fmt.money(subtotal, currency)}</td>
            </tr>
            <tr class="sanvi-checkout-total-row">
              <td colspan={2} class="sanvi-checkout-label-total">{t['storefront.checkout.total']()}</td>
              <td class="sanvi-checkout-value-total">{fmt.money(total, currency)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <aside
        class="sanvi-checkout-tax-note"
        aria-label={taxEnabled
          ? t['storefront.checkout.taxNote']()
          : t['storefront.checkout.taxNoteDisabled']()}
      >
        <p>
          {taxEnabled
            ? t['storefront.checkout.taxNote']()
            : t['storefront.checkout.taxNoteDisabled']()}
        </p>
      </aside>
      {/if}

      <div class="sanvi-checkout-actions">
        {#if !canPay}
          <div class="sanvi-checkout-disabled-reason" role="status">
            <p>{effectiveCannotAcceptReason}</p>
          </div>
        {/if}

        <Button
          variant="primary"
          disabled={!canPay || isSubmitting}
          loading={isSubmitting}
          loadingLabel={t['storefront.checkout.loading']()}
          onclick={handleCheckout}
        >
          {t['storefront.checkout.payButton']()}
        </Button>
      </div>
    {/if}
  </Stack>
</Container>

<style>
  .sanvi-checkout-header {
    border-bottom: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    padding-bottom: var(--sanvi-spacing-4);
  }

  .sanvi-checkout-title {
    margin: 0;
    font-size: var(--sanvi-font-size-2xl);
    font-weight: var(--sanvi-font-weight-bold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-checkout-empty {
    font-size: var(--sanvi-font-size-base);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-checkout-items {
    width: 100%;
    overflow-x: auto;
  }

  .sanvi-checkout-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-checkout-table th {
    text-align: left;
    padding: var(--sanvi-spacing-3);
    color: var(--sanvi-color-text-secondary);
    border-bottom: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
  }

  .sanvi-checkout-th-price,
  .sanvi-checkout-td-price,
  .sanvi-checkout-value,
  .sanvi-checkout-value-total {
    text-align: right;
  }

  .sanvi-checkout-th-qty,
  .sanvi-checkout-td-qty {
    text-align: center;
    width: var(--sanvi-spacing-16);
  }

  .sanvi-checkout-row td {
    padding: var(--sanvi-spacing-4) var(--sanvi-spacing-3);
    border-bottom: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-subtle);
    vertical-align: top;
  }

  .sanvi-item-name {
    font-weight: var(--sanvi-font-weight-medium);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-item-desc {
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
    margin-top: var(--sanvi-spacing-1);
  }

  .sanvi-checkout-subtotal-row td {
    padding: var(--sanvi-spacing-3);
    color: var(--sanvi-color-text-secondary);
    border-top: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
  }

  .sanvi-checkout-total-row td {
    padding: var(--sanvi-spacing-4) var(--sanvi-spacing-3);
    font-weight: var(--sanvi-font-weight-bold);
    font-size: var(--sanvi-font-size-base);
    color: var(--sanvi-color-text-primary);
    border-top: var(--sanvi-border-width-medium) solid var(--sanvi-color-border-default);
  }

  .sanvi-checkout-tax-note {
    background: var(--sanvi-color-background-secondary);
    border-radius: var(--sanvi-radius-md);
    padding: var(--sanvi-spacing-3) var(--sanvi-spacing-4);
  }

  .sanvi-checkout-tax-note p {
    margin: 0;
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-checkout-actions {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--sanvi-spacing-3);
  }

  .sanvi-checkout-disabled-reason p {
    margin: 0;
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-danger);
  }
</style>
