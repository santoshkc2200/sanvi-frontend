<script lang="ts">
import Button from './Button.svelte'

interface Props {
  daysRemaining?: number
  portalHref?: string
  onUpdatePayment?: () => void
  class?: string
}

let {
  daysRemaining,
  portalHref = '/billing',
  onUpdatePayment,
  class: className = '',
}: Props = $props()

const COPY = {
  bannerLabel: 'Payment warning',
  title: 'Payment past due',
  descriptionWithDays: (days: number) =>
    `Your latest payment failed. You have ${days} days remaining in your grace period before workspace access is paused.`,
  descriptionDefault:
    'Your latest payment failed. Please update your payment method to keep your subscription active.',
  cta: 'Update payment method',
}

const description = $derived(
  daysRemaining !== undefined && daysRemaining > 0
    ? COPY.descriptionWithDays(daysRemaining)
    : COPY.descriptionDefault,
)
</script>

<aside class="sanvi-past-due-banner {className}" aria-label={COPY.bannerLabel}>
  <div class="sanvi-past-due-banner__text">
    <strong class="sanvi-past-due-banner__title">{COPY.title}:</strong>
    <span class="sanvi-past-due-banner__description">{description}</span>
  </div>
  <div class="sanvi-past-due-banner__action">
    {#if onUpdatePayment}
      <Button variant="danger" onclick={onUpdatePayment}>
        {COPY.cta}
      </Button>
    {:else}
      <a class="sanvi-past-due-banner__link" href={portalHref}>
        {COPY.cta}
      </a>
    {/if}
  </div>
</aside>

<style>
  .sanvi-past-due-banner {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--sanvi-spacing-4);
    padding: var(--sanvi-spacing-3) var(--sanvi-spacing-5);
    background: var(--sanvi-color-status-warning);
    border-block-end: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-past-due-banner__text {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sanvi-spacing-2);
    font-size: var(--sanvi-font-size-sm);
    flex: 1 1 auto;
  }

  .sanvi-past-due-banner__title {
    font-weight: var(--sanvi-font-weight-bold);
  }

  .sanvi-past-due-banner__action {
    flex-shrink: 0;
  }

  .sanvi-past-due-banner__link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--sanvi-spacing-1-5) var(--sanvi-spacing-3);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-solid-danger-base);
    color: var(--sanvi-color-text-inverse);
    text-decoration: none;
    font-weight: var(--sanvi-font-weight-medium);
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-past-due-banner__link:hover {
    background: var(--sanvi-color-solid-danger-hover);
  }
</style>
