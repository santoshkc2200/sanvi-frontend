<script lang="ts">
import { onMount } from 'svelte'
import { fmt, t } from '@sanvi/i18n'
import { Alert, Button, Container, Stack } from '@sanvi/ui'
import { localePath } from '$lib/links'
import { recordConversionOnce } from './conversion'
import { calculateCartTotal } from './cart.svelte'
import type { CheckoutView, OrderItem } from './types'

interface Props {
  checkout: CheckoutView
  items?: OrderItem[]
  onConversionReported?: (conversionEventId: string) => void
}

let { checkout, items, onConversionReported }: Props = $props()

onMount(() => {
  if (checkout.conversion_event_id) {
    recordConversionOnce(checkout.conversion_event_id, onConversionReported)
  }
})

const hasMatchingItems = $derived(
  Boolean(items && items.length > 0 && calculateCartTotal(items) === checkout.amount_minor),
)

const returnHomeHref = $derived(localePath('/'))
</script>

<Container size="md" padding="6">
  <Stack gap="6">
    <header class="sanvi-confirmation-header">
      <div class="sanvi-confirmation-badge" role="status">
        <svg
          class="sanvi-confirmation-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      </div>
      <h1 class="sanvi-confirmation-title">{t['storefront.checkout.confirmation.title']()}</h1>
      <p class="sanvi-confirmation-subtitle">{t['storefront.checkout.confirmation.thankYou']()}</p>
      <p class="sanvi-confirmation-reference">
        {t['storefront.checkout.confirmation.orderNumber']({ reference: checkout.reference })}
      </p>
    </header>

    <div class="sanvi-confirmation-details" role="region" aria-label={t['storefront.checkout.title']()}>
      <table class="sanvi-confirmation-table">
        {#if hasMatchingItems && items}
          <thead>
            <tr>
              <th scope="col">{t['storefront.checkout.item']()}</th>
              <th scope="col" class="sanvi-confirmation-th-qty">{t['storefront.checkout.quantity']()}</th>
              <th scope="col" class="sanvi-confirmation-th-price">{t['storefront.checkout.price']()}</th>
            </tr>
          </thead>
          <tbody>
            {#each items as item (item.id)}
              <tr>
                <td>
                  <div class="sanvi-item-name">{item.name}</div>
                  {#if item.description}
                    <div class="sanvi-item-desc">{item.description}</div>
                  {/if}
                </td>
                <td class="sanvi-confirmation-td-qty">{item.quantity}</td>
                <td class="sanvi-confirmation-td-price">{fmt.money(item.amount_minor * item.quantity, checkout.currency)}</td>
              </tr>
            {/each}
          </tbody>
          <tfoot>
            <tr class="sanvi-confirmation-total-row">
              <td colspan={2}>{t['storefront.checkout.confirmation.amountPaid']()}</td>
              <td class="sanvi-confirmation-td-price">{fmt.money(checkout.amount_minor, checkout.currency)}</td>
            </tr>
          </tfoot>
        {:else}
          <tfoot>
            <tr class="sanvi-confirmation-total-row">
              <td>{t['storefront.checkout.confirmation.amountPaid']()}</td>
              <td class="sanvi-confirmation-td-price">{fmt.money(checkout.amount_minor, checkout.currency)}</td>
            </tr>
          </tfoot>
        {/if}
      </table>
    </div>

    <Alert variant="success">
      <p>{t['storefront.checkout.confirmation.receiptNote']()}</p>
    </Alert>

    <section class="sanvi-confirmation-next-steps" aria-labelledby="next-steps-heading">
      <h2 id="next-steps-heading" class="sanvi-next-steps-title">
        {t['storefront.checkout.confirmation.nextStepsTitle']()}
      </h2>
      <p class="sanvi-next-steps-body">
        {t['storefront.checkout.confirmation.nextStepsBody']()}
      </p>
    </section>

    <div class="sanvi-confirmation-actions">
      <a href={returnHomeHref} class="sanvi-confirmation-home-link">
        <Button variant="primary">
          {t['storefront.checkout.confirmation.returnHome']()}
        </Button>
      </a>
    </div>
  </Stack>
</Container>

<style>
  .sanvi-confirmation-header {
    text-align: center;
    padding-bottom: var(--sanvi-spacing-4);
    border-bottom: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
  }

  .sanvi-confirmation-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--sanvi-spacing-12);
    height: var(--sanvi-spacing-12);
    border-radius: var(--sanvi-radius-full);
    background: var(--sanvi-color-background-success);
    color: var(--sanvi-color-text-success);
    margin-bottom: var(--sanvi-spacing-3);
  }

  .sanvi-confirmation-icon {
    width: var(--sanvi-spacing-6);
    height: var(--sanvi-spacing-6);
  }

  .sanvi-confirmation-title {
    margin: 0;
    font-size: var(--sanvi-font-size-2xl);
    font-weight: var(--sanvi-font-weight-bold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-confirmation-subtitle {
    margin: var(--sanvi-spacing-2) 0 0 0;
    font-size: var(--sanvi-font-size-base);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-confirmation-reference {
    margin: var(--sanvi-spacing-1) 0 0 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
    font-family: var(--sanvi-font-family-mono);
  }

  .sanvi-confirmation-details {
    width: 100%;
    overflow-x: auto;
  }

  .sanvi-confirmation-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-confirmation-table th {
    text-align: left;
    padding: var(--sanvi-spacing-3);
    color: var(--sanvi-color-text-secondary);
    border-bottom: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
  }

  .sanvi-confirmation-th-price,
  .sanvi-confirmation-td-price {
    text-align: right;
  }

  .sanvi-confirmation-th-qty,
  .sanvi-confirmation-td-qty {
    text-align: center;
    width: var(--sanvi-spacing-16);
  }

  .sanvi-confirmation-table td {
    padding: var(--sanvi-spacing-3);
    border-bottom: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-subtle);
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

  .sanvi-confirmation-total-row td {
    padding: var(--sanvi-spacing-4) var(--sanvi-spacing-3);
    font-weight: var(--sanvi-font-weight-bold);
    font-size: var(--sanvi-font-size-base);
    color: var(--sanvi-color-text-primary);
    border-top: var(--sanvi-border-width-medium) solid var(--sanvi-color-border-default);
  }

  .sanvi-confirmation-next-steps {
    background: var(--sanvi-color-background-secondary);
    border-radius: var(--sanvi-radius-md);
    padding: var(--sanvi-spacing-4);
  }

  .sanvi-next-steps-title {
    margin: 0;
    font-size: var(--sanvi-font-size-base);
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-next-steps-body {
    margin: var(--sanvi-spacing-2) 0 0 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
    line-height: var(--sanvi-line-height-relaxed);
  }

  .sanvi-confirmation-actions {
    display: flex;
    justify-content: center;
  }

  .sanvi-confirmation-home-link {
    text-decoration: none;
  }
</style>
