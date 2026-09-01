<script lang="ts">
import type { Snippet } from 'svelte'
import Badge from './Badge.svelte'
import Button from './Button.svelte'
import UpgradePrompt from './UpgradePrompt.svelte'

type ProviderView = {
  kind: string
  display_name: string
  available: boolean
  requires_onboarding: boolean
  supported_countries: string[]
}

interface Labels {
  connectCta?: string
  unavailableTitle?: string
  unavailableDescription?: string
  supportedCountriesLabel?: string
  upgradeTitle?: string
  upgradeDescription?: string
  upgradeCtaLabel?: string
  connectDisabledReason?: string
}

interface Props {
  provider: ProviderView
  entitled?: boolean
  connectDisabled?: boolean
  connectDisabledReason?: string
  labels?: Labels
  upgradeHref?: string
  onConnect?: (provider: ProviderView) => void
  status?: Snippet
  class?: string
}

let {
  provider,
  entitled = true,
  connectDisabled = false,
  connectDisabledReason,
  labels = {},
  upgradeHref = '/billing',
  onConnect,
  status,
  class: className = '',
}: Props = $props()

const COPY = {
  connectCta: 'Connect',
  unavailableTitle: 'Unavailable in your region',
  unavailableDescription: 'This provider is not available in your country.',
  supportedCountriesLabel: 'Supported countries',
  upgradeTitle: 'Upgrade required',
  upgradeDescription:
    'Accepting payments needs a plan with Stripe Connect. Ask a tenant owner to upgrade.',
  upgradeCtaLabel: 'View plans & upgrade',
  connectDisabledReason: 'Connecting is not available yet.',
}

const displayConnectCta = $derived(labels.connectCta ?? COPY.connectCta)
const displayUnavailableTitle = $derived(labels.unavailableTitle ?? COPY.unavailableTitle)
const displayUnavailableDescription = $derived(
  labels.unavailableDescription ?? COPY.unavailableDescription,
)
const displaySupportedCountriesLabel = $derived(
  labels.supportedCountriesLabel ?? COPY.supportedCountriesLabel,
)
const displayUpgradeTitle = $derived(labels.upgradeTitle ?? COPY.upgradeTitle)
const displayUpgradeDescription = $derived(labels.upgradeDescription ?? COPY.upgradeDescription)
const displayUpgradeCta = $derived(labels.upgradeCtaLabel ?? COPY.upgradeCtaLabel)
const displayConnectDisabledReason = $derived(
  connectDisabledReason ??
    labels.connectDisabledReason ??
    (connectDisabled ? COPY.connectDisabledReason : undefined),
)

const supportedCountriesText = $derived(provider.supported_countries.join(', '))

// Kinds are unique within a catalog (the list is keyed by kind), so this is a
// stable per-card id for `aria-describedby`.
const disabledReasonId = $derived(`sanvi-payment-provider-card__reason--${provider.kind}`)

function handleConnect(): void {
  onConnect?.(provider)
}
</script>

<article class="sanvi-payment-provider-card {className}" data-provider-kind={provider.kind}>
  <div class="sanvi-payment-provider-card__header">
    <h3 class="sanvi-payment-provider-card__title">{provider.display_name}</h3>
    {#if !provider.available}
      <Badge variant="warning">
        {#snippet children()}
          {displayUnavailableTitle}
        {/snippet}
      </Badge>
    {/if}
  </div>

  {#if status}
    <div class="sanvi-payment-provider-card__status">
      {@render status()}
    </div>
  {/if}

  {#if !provider.available}
    <div class="sanvi-payment-provider-card__unavailable">
      <p class="sanvi-payment-provider-card__unavailable-text">{displayUnavailableDescription}</p>
      {#if provider.supported_countries.length > 0}
        <p class="sanvi-payment-provider-card__countries">
          {displaySupportedCountriesLabel}: {supportedCountriesText}
        </p>
      {/if}
    </div>
  {:else if !entitled}
    <div class="sanvi-payment-provider-card__upgrade">
      <UpgradePrompt
        feature="payments.stripe_connect"
        title={displayUpgradeTitle}
        description={displayUpgradeDescription}
        ctaLabel={displayUpgradeCta}
        upgradeHref={upgradeHref}
      />
    </div>
  {:else}
    <div class="sanvi-payment-provider-card__action">
      <!-- `ariaDisabled`, not `disabled`: the button stays focusable so a keyboard
           or screen-reader user reaches it and hears the reason it is inert. -->
      <Button
        variant="primary"
        ariaDisabled={connectDisabled}
        ariaDescribedby={connectDisabled && displayConnectDisabledReason
          ? disabledReasonId
          : undefined}
        onclick={handleConnect}
      >
        {displayConnectCta}
      </Button>
      {#if connectDisabled && displayConnectDisabledReason}
        <p id={disabledReasonId} class="sanvi-payment-provider-card__disabled-reason">
          {displayConnectDisabledReason}
        </p>
      {/if}
    </div>
  {/if}
</article>

<style>
  .sanvi-payment-provider-card {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-4);
    padding: var(--sanvi-spacing-6);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-lg);
    background: var(--sanvi-color-background-primary);
  }

  .sanvi-payment-provider-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sanvi-spacing-3);
  }

  .sanvi-payment-provider-card__title {
    margin: 0;
    font-size: var(--sanvi-font-size-lg);
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-payment-provider-card__status {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-payment-provider-card__unavailable {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-payment-provider-card__unavailable-text {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-payment-provider-card__countries {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-payment-provider-card__upgrade {
    display: flex;
    flex-direction: column;
  }

  .sanvi-payment-provider-card__action {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-payment-provider-card__disabled-reason {
    margin: 0;
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
  }
</style>
