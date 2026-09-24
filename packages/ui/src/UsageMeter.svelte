<script lang="ts">
interface Props {
  label: string
  used: number
  /** `null` — unlimited; the meter renders `used` with no bar. */
  limit: number | null
  unit?: string
  /** Fraction of `limit` (0–1) at which the meter turns to the warning color. */
  warningThreshold?: number
  /** Fraction of `limit` (0–1) at which the meter turns to the critical color. */
  criticalThreshold?: number
  class?: string
}

let {
  label,
  used,
  limit,
  unit = '',
  warningThreshold = 0.8,
  criticalThreshold = 0.95,
  class: className = '',
}: Props = $props()

const ratio = $derived(limit && limit > 0 ? Math.min(used / limit, 1) : 0)
const status: 'ok' | 'warning' | 'critical' = $derived(
  limit === null
    ? 'ok'
    : ratio >= criticalThreshold
      ? 'critical'
      : ratio >= warningThreshold
        ? 'warning'
        : 'ok',
)
const valueText = $derived(
  limit === null
    ? `${used.toLocaleString()} ${unit}`.trim()
    : `${used.toLocaleString()} / ${limit.toLocaleString()} ${unit}`.trim(),
)
</script>

<div class="sanvi-usage-meter {className}">
  <div class="sanvi-usage-meter__header">
    <span class="sanvi-usage-meter__label">{label}</span>
    <span class="sanvi-usage-meter__value">{valueText}</span>
  </div>
  {#if limit !== null}
    <div
      class="sanvi-usage-meter__track"
      role="progressbar"
      aria-label={label}
      aria-valuenow={used}
      aria-valuemin={0}
      aria-valuemax={limit}
    >
      <div class="sanvi-usage-meter__fill sanvi-usage-meter__fill--{status}" style:--sanvi-usage-meter-ratio={ratio}></div>
    </div>
  {/if}
</div>

<style>
  .sanvi-usage-meter {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-1);
  }

  .sanvi-usage-meter__header {
    display: flex;
    justify-content: space-between;
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-usage-meter__label {
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-usage-meter__value {
    font-variant-numeric: tabular-nums;
  }

  .sanvi-usage-meter__track {
    inline-size: 100%;
    block-size: var(--sanvi-spacing-2);
    border-radius: var(--sanvi-radius-full);
    background: var(--sanvi-color-background-tertiary);
    overflow: hidden;
  }

  .sanvi-usage-meter__fill {
    block-size: 100%;
    inline-size: calc(var(--sanvi-usage-meter-ratio) * 100%);
    border-radius: var(--sanvi-radius-full);
    transition: inline-size 0.2s ease;
  }

  .sanvi-usage-meter__fill--ok {
    background: var(--sanvi-color-solid-primary-base);
  }
  .sanvi-usage-meter__fill--warning {
    background: var(--sanvi-color-status-warning);
  }
  .sanvi-usage-meter__fill--critical {
    background: var(--sanvi-color-status-error);
  }
</style>
