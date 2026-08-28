<script lang="ts">
import Button from './Button.svelte'

interface Props {
  feature?: string
  title?: string
  description?: string
  ctaLabel?: string
  upgradeHref?: string
  onUpgrade?: () => void
  class?: string
}

let {
  feature,
  title,
  description,
  ctaLabel,
  upgradeHref = '/billing',
  onUpgrade,
  class: className = '',
}: Props = $props()

const COPY = {
  defaultTitle: 'Upgrade to unlock this feature',
  defaultDescription: (feat?: string) =>
    feat
      ? `The "${feat}" feature is available on a higher plan tier. Upgrade your subscription to gain access.`
      : 'This feature is available on a higher plan tier. Upgrade your subscription to gain access.',
  defaultCta: 'View plans & upgrade',
}

const displayTitle = $derived(title ?? COPY.defaultTitle)
const displayDescription = $derived(description ?? COPY.defaultDescription(feature))
const displayCta = $derived(ctaLabel ?? COPY.defaultCta)
</script>

<aside class="sanvi-upgrade-prompt {className}" aria-label={displayTitle}>
  <div class="sanvi-upgrade-prompt__content">
    <h3 class="sanvi-upgrade-prompt__title">{displayTitle}</h3>
    <p class="sanvi-upgrade-prompt__description">{displayDescription}</p>
  </div>
  <div class="sanvi-upgrade-prompt__action">
    {#if onUpgrade}
      <Button variant="primary" onclick={onUpgrade}>
        {displayCta}
      </Button>
    {:else}
      <a class="sanvi-upgrade-prompt__link" href={upgradeHref}>
        {displayCta}
      </a>
    {/if}
  </div>
</aside>

<style>
  .sanvi-upgrade-prompt {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--sanvi-spacing-4);
    padding: var(--sanvi-spacing-5) var(--sanvi-spacing-6);
    border-radius: var(--sanvi-radius-lg);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    background: var(--sanvi-color-background-secondary);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-upgrade-prompt__content {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-1);
    flex: 1 1 auto;
  }

  .sanvi-upgrade-prompt__title {
    margin: 0;
    font-size: var(--sanvi-font-size-md);
    font-weight: var(--sanvi-font-weight-semibold);
  }

  .sanvi-upgrade-prompt__description {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-upgrade-prompt__action {
    flex-shrink: 0;
  }

  .sanvi-upgrade-prompt__link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-4);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-solid-primary-base);
    color: var(--sanvi-color-text-inverse);
    text-decoration: none;
    font-weight: var(--sanvi-font-weight-medium);
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-upgrade-prompt__link:hover {
    background: var(--sanvi-color-solid-primary-hover);
  }
</style>
