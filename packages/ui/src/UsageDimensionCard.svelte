<script lang="ts">
import UsageMeter from './UsageMeter.svelte'

interface Props {
  /** Dimension display name (already localized by the caller). */
  name: string
  used: number
  limit: number
  unit?: string
  /** Fraction of `limit` (0–1) at which the warning state shows. */
  warningThreshold?: number
  /** Kept for parity with `UsageMeter` — `used >= limit` is the wall, not a ratio. */
  criticalThreshold?: number
  /** Shown at `warningThreshold` ≤ ratio < wall. Names the dimension. */
  warningText?: string
  /** Shown at `used >= limit`. Names the limit, the reset time, the upgrade. */
  limitReachedText?: string
  upgradeCtaLabel?: string
  upgradeHref?: string
  class?: string
}

let {
  name,
  used,
  limit,
  unit = '',
  warningThreshold = 0.8,
  criticalThreshold: _criticalThreshold = 0.95,
  warningText,
  limitReachedText,
  upgradeCtaLabel,
  upgradeHref,
  class: className = '',
}: Props = $props()

// The wall is `used >= limit`, not the meter's critical ratio: a dimension
// at 96% of limit is red on the bar but has not hit the wall yet, so it
// reads as warning, not reached. Thresholds intentionally mirror
// `UsageMeter`'s defaults so bar colour and copy never disagree.
const status: 'ok' | 'warning' | 'reached' = $derived(
  limit > 0 && used >= limit
    ? 'reached'
    : limit > 0 && used / limit >= warningThreshold
      ? 'warning'
      : 'ok',
)

const stateText = $derived(status === 'reached' ? limitReachedText : warningText)
const showUpgrade = $derived(
  status !== 'ok' && upgradeCtaLabel !== undefined && upgradeHref !== undefined,
)
</script>

<div class="sanvi-usage-dimension-card {className}">
  <h3 class="sanvi-usage-dimension-card__name">{name}</h3>
  <UsageMeter
    label={name}
    {used}
    {limit}
    {unit}
    {warningThreshold}
    criticalThreshold={_criticalThreshold}
  />
  {#if status !== 'ok' && stateText}
    <p class="sanvi-usage-dimension-card__state sanvi-usage-dimension-card__state--{status}">
      {stateText}
    </p>
  {/if}
  {#if showUpgrade}
    <a class="sanvi-usage-dimension-card__upgrade" href={upgradeHref}>
      {upgradeCtaLabel}
    </a>
  {/if}
</div>

<style>
  .sanvi-usage-dimension-card {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
    padding: var(--sanvi-spacing-4);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-md);
  }

  .sanvi-usage-dimension-card__name {
    margin: 0;
    font-size: var(--sanvi-font-size-base);
    font-weight: var(--sanvi-font-weight-semibold);
  }

  .sanvi-usage-dimension-card__state {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-usage-dimension-card__state--warning {
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-usage-dimension-card__state--reached {
    color: var(--sanvi-color-text-secondary);
    font-weight: var(--sanvi-font-weight-medium);
  }

  .sanvi-usage-dimension-card__upgrade {
    font-size: var(--sanvi-font-size-sm);
    font-weight: var(--sanvi-font-weight-medium);
    color: var(--sanvi-color-solid-primary-base);
  }
</style>
