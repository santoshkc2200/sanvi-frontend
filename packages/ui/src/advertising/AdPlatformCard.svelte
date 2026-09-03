<script lang="ts">
import type { Snippet } from 'svelte'
import Badge from '../Badge.svelte'
import Button from '../Button.svelte'
import UpgradePrompt from '../UpgradePrompt.svelte'
import { humanizeOptionValue } from '../forms/humanize'
import type { AdPlatform } from '../forms/types'

/**
 * One advertising platform in the catalog (phase 10, TASK-010). Shows the
 * entitlement state, the connection state, what connecting will allow
 * (straight from the platform's capability matrix), and — once TASK-011
 * lands the connection flow — the OAuth scopes that will be requested.
 *
 * TASK-011's connection screen composes this card rather than replacing it,
 * the way the payments settings compose `PaymentProviderCard`. Everything
 * platform-specific arrives as data: the card contains no platform names,
 * objectives, or placement literals, so a new network in the backend's
 * registry renders here with no frontend change.
 */
interface Labels {
  connectCta?: string
  upgradeTitle?: string
  upgradeDescription?: string
  upgradeCtaLabel?: string
  unavailableTitle?: string
  unavailableDescription?: string
  capabilitiesLabel?: string
  objectivesLabel?: string
  placementsLabel?: string
  scopesLabel?: string
  connectDisabledReason?: string
}

interface Props {
  platform: AdPlatform
  /**
   * Whether *this tenant* holds the platform entitlement. The caller reads
   * it from `platform.entitlement_key` — the card never interprets
   * entitlement keys itself.
   */
  entitled?: boolean
  labels?: Labels
  /** Per-connection-state display labels, keyed by the state value itself. */
  connectionLabels?: Record<string, string>
  /** Per-connection-state badge variants, same keys. */
  connectionTones?: Record<string, 'neutral' | 'info' | 'success' | 'warning' | 'error'>
  /** Localized labels for matrix values (objectives, placements), keyed by value. */
  optionLabels?: Record<string, string>
  /** The OAuth scopes connecting will request (TASK-011 fills this). */
  scopes?: string[]
  connectDisabled?: boolean
  upgradeHref?: string
  onConnect?: (platform: AdPlatform) => void
  status?: Snippet
  class?: string
}

let {
  platform,
  entitled = true,
  labels = {},
  connectionLabels = {},
  connectionTones = {},
  optionLabels = {},
  scopes,
  connectDisabled = false,
  upgradeHref = '/billing',
  onConnect,
  status,
  class: className = '',
}: Props = $props()

const COPY = {
  connectCta: 'Connect',
  upgradeTitle: 'Upgrade required',
  upgradeDescription:
    'Advertising on this platform needs a plan that includes it. Ask a tenant owner to upgrade.',
  upgradeCtaLabel: 'View plans & upgrade',
  unavailableTitle: 'Unavailable',
  unavailableDescription: 'This platform is not available for your account yet.',
  capabilitiesLabel: 'What connecting allows',
  objectivesLabel: 'Objectives',
  placementsLabel: 'Placements',
  scopesLabel: 'Permissions requested',
  connectDisabledReason: 'Connecting is not available yet.',
}

const displayConnectCta = $derived(labels.connectCta ?? COPY.connectCta)
const displayUpgradeTitle = $derived(labels.upgradeTitle ?? COPY.upgradeTitle)
const displayUpgradeDescription = $derived(labels.upgradeDescription ?? COPY.upgradeDescription)
const displayUpgradeCta = $derived(labels.upgradeCtaLabel ?? COPY.upgradeCtaLabel)
const displayUnavailableTitle = $derived(labels.unavailableTitle ?? COPY.unavailableTitle)
const displayUnavailableDescription = $derived(
  labels.unavailableDescription ?? COPY.unavailableDescription,
)
const displayCapabilitiesLabel = $derived(labels.capabilitiesLabel ?? COPY.capabilitiesLabel)
const displayObjectivesLabel = $derived(labels.objectivesLabel ?? COPY.objectivesLabel)
const displayPlacementsLabel = $derived(labels.placementsLabel ?? COPY.placementsLabel)
const displayScopesLabel = $derived(labels.scopesLabel ?? COPY.scopesLabel)
const displayConnectDisabledReason = $derived(
  labels.connectDisabledReason ?? COPY.connectDisabledReason,
)

const connectionLabel = $derived(connectionLabels[platform.connection_state])
const connectionTone = $derived(connectionTones[platform.connection_state] ?? 'neutral')

// Kinds are unique within a catalog (the list is keyed by platform key), so
// this is a stable per-card id for `aria-describedby`.
const disabledReasonId = $derived(`sanvi-ad-platform-card__reason--${platform.key}`)

const labelFor = (value: string): string => optionLabels[value] ?? humanizeOptionValue(value)

const objectiveSummary = $derived(platform.capability_matrix.objectives.map(labelFor).join(', '))
const placementSummary = $derived(
  platform.capability_matrix.creative_placements
    .map((placement) => labelFor(placement.key))
    .join(', '),
)

function handleConnect(): void {
  onConnect?.(platform)
}
</script>

<article class="sanvi-ad-platform-card {className}" data-platform-key={platform.key}>
  <div class="sanvi-ad-platform-card__header">
    <h3 class="sanvi-ad-platform-card__title">{platform.display_name}</h3>
    {#if connectionLabel}
      <Badge variant={connectionTone}>
        {#snippet children()}
          {connectionLabel}
        {/snippet}
      </Badge>
    {/if}
    {#if !platform.available}
      <Badge variant="warning">
        {#snippet children()}
          {displayUnavailableTitle}
        {/snippet}
      </Badge>
    {/if}
  </div>

  {#if status}
    <div class="sanvi-ad-platform-card__status">
      {@render status()}
    </div>
  {/if}

  <div class="sanvi-ad-platform-card__capabilities">
    <p class="sanvi-ad-platform-card__capabilities-heading">{displayCapabilitiesLabel}</p>
    <dl class="sanvi-ad-platform-card__capability-list">
      {#if platform.capability_matrix.objectives.length > 0}
        <div class="sanvi-ad-platform-card__capability-row">
          <dt>{displayObjectivesLabel}</dt>
          <dd>{objectiveSummary}</dd>
        </div>
      {/if}
      {#if platform.capability_matrix.creative_placements.length > 0}
        <div class="sanvi-ad-platform-card__capability-row">
          <dt>{displayPlacementsLabel}</dt>
          <dd>{placementSummary}</dd>
        </div>
      {/if}
    </dl>
  </div>

  {#if scopes && scopes.length > 0}
    <div class="sanvi-ad-platform-card__scopes">
      <p class="sanvi-ad-platform-card__scopes-heading">{displayScopesLabel}</p>
      <ul class="sanvi-ad-platform-card__scope-list">
        {#each scopes as scope (scope)}
          <li>{scope}</li>
        {/each}
      </ul>
    </div>
  {/if}

  {#if !platform.available}
    <p class="sanvi-ad-platform-card__unavailable-text">{displayUnavailableDescription}</p>
  {:else if !entitled}
    <div class="sanvi-ad-platform-card__upgrade">
      <UpgradePrompt
        title={displayUpgradeTitle}
        description={displayUpgradeDescription}
        ctaLabel={displayUpgradeCta}
        upgradeHref={upgradeHref}
      />
    </div>
  {:else}
    <div class="sanvi-ad-platform-card__action">
      <!-- `ariaDisabled`, not `disabled`: the button stays focusable so a keyboard
           or screen-reader user reaches it and hears the reason it is inert. -->
      <Button
        variant="primary"
        ariaDisabled={connectDisabled}
        ariaDescribedby={connectDisabled ? disabledReasonId : undefined}
        onclick={handleConnect}
      >
        {displayConnectCta}
      </Button>
      {#if connectDisabled}
        <p id={disabledReasonId} class="sanvi-ad-platform-card__disabled-reason">
          {displayConnectDisabledReason}
        </p>
      {/if}
    </div>
  {/if}
</article>

<style>
  .sanvi-ad-platform-card {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-4);
    padding: var(--sanvi-spacing-6);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-lg);
    background: var(--sanvi-color-background-primary);
  }

  .sanvi-ad-platform-card__header {
    display: flex;
    align-items: center;
    gap: var(--sanvi-spacing-3);
    flex-wrap: wrap;
  }

  .sanvi-ad-platform-card__title {
    margin: 0;
    font-size: var(--sanvi-font-size-lg);
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-primary);
    margin-inline-end: auto;
  }

  .sanvi-ad-platform-card__status {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-ad-platform-card__capabilities-heading,
  .sanvi-ad-platform-card__scopes-heading {
    margin: 0 0 var(--sanvi-spacing-1);
    font-size: var(--sanvi-font-size-sm);
    font-weight: var(--sanvi-font-weight-medium);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-ad-platform-card__capability-list {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-1);
  }

  .sanvi-ad-platform-card__capability-row {
    display: flex;
    gap: var(--sanvi-spacing-2);
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-ad-platform-card__capability-row dt {
    color: var(--sanvi-color-text-secondary);
    min-inline-size: var(--sanvi-spacing-32);
  }

  .sanvi-ad-platform-card__capability-row dd {
    margin: 0;
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-ad-platform-card__scope-list {
    margin: 0;
    padding-inline-start: var(--sanvi-spacing-5);
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-ad-platform-card__upgrade {
    display: flex;
    flex-direction: column;
  }

  .sanvi-ad-platform-card__unavailable-text {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-ad-platform-card__action {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-ad-platform-card__disabled-reason {
    margin: 0;
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
  }
</style>
