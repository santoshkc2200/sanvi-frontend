<script lang="ts">
import Button from './Button.svelte'

interface Props {
  daysRemaining: number
  trialEnd?: string
  subscribeHref?: string
  onSubscribe?: () => void
  isUrgent?: boolean
  class?: string
}

let {
  daysRemaining,
  trialEnd,
  subscribeHref = '/billing',
  onSubscribe,
  isUrgent: customUrgent,
  class: className = '',
}: Props = $props()

const isUrgent = $derived(customUrgent ?? daysRemaining <= 2)

const COPY = {
  bannerLabel: 'Subscription trial status',
  remainingDays: (days: number) => {
    if (days <= 0) return 'Your free trial ends today.'
    if (days === 1) return '1 day left in your free trial.'
    return `${days} days left in your free trial.`
  },
  endsOn: (date: string) => ` (ends ${date})`,
  cta: 'Upgrade now',
}

const message = $derived(
  COPY.remainingDays(daysRemaining) + (trialEnd ? COPY.endsOn(trialEnd) : ''),
)
</script>

<div
  class="sanvi-trial-banner {isUrgent ? 'sanvi-trial-banner--urgent' : ''} {className}"
  role="region"
  aria-label={COPY.bannerLabel}
>
  <div class="sanvi-trial-banner__text">
    <span class="sanvi-trial-banner__badge" aria-hidden="true">
      {isUrgent ? '!' : 'i'}
    </span>
    <span class="sanvi-trial-banner__message">{message}</span>
  </div>
  <div class="sanvi-trial-banner__action">
    {#if onSubscribe}
      <Button variant="primary" onclick={onSubscribe}>
        {COPY.cta}
      </Button>
    {:else}
      <a class="sanvi-trial-banner__link" href={subscribeHref}>
        {COPY.cta}
      </a>
    {/if}
  </div>
</div>

<style>
  .sanvi-trial-banner {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: var(--sanvi-spacing-4);
    padding: var(--sanvi-spacing-3) var(--sanvi-spacing-5);
    background: var(--sanvi-color-background-secondary);
    border-block-end: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-trial-banner--urgent {
    background: var(--sanvi-color-status-warning);
    color: var(--sanvi-color-text-primary);
    border-block-end-color: var(--sanvi-color-status-warning);
  }

  .sanvi-trial-banner__text {
    display: flex;
    align-items: center;
    gap: var(--sanvi-spacing-2);
    font-size: var(--sanvi-font-size-sm);
    font-weight: var(--sanvi-font-weight-medium);
  }

  .sanvi-trial-banner__badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--sanvi-spacing-5);
    height: var(--sanvi-spacing-5);
    border-radius: var(--sanvi-radius-full);
    background: var(--sanvi-color-background-primary);
    font-size: var(--sanvi-font-size-xs);
    font-weight: var(--sanvi-font-weight-bold);
  }

  .sanvi-trial-banner__action {
    flex-shrink: 0;
  }

  .sanvi-trial-banner__link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--sanvi-spacing-1-5) var(--sanvi-spacing-3);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-solid-primary-base);
    color: var(--sanvi-color-text-inverse);
    text-decoration: none;
    font-weight: var(--sanvi-font-weight-medium);
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-trial-banner__link:hover {
    background: var(--sanvi-color-solid-primary-hover);
  }
</style>
