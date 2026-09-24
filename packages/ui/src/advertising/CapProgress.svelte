<script lang="ts">
import Badge from '../Badge.svelte'

/**
 * The budget-cap progress indicator (phase 10, TASK-017).
 *
 * Renders one scope's spend against its cap. Two rules from the task shape
 * this component:
 *
 * 1. **Never colour alone.** The state is carried by a status word and the
 *    percentage figure as text; the fill's hue only repeats what the words
 *    already say, so the screen survives colour blindness and greyscale.
 * 2. **Every figure carries its freshness.** The freshness sentence is a
 *    required prop, not an optional garnish — a spend figure without its
 *    "as of" reads as settled when it is not.
 *
 * Presentational by the labels-as-data rule: every string arrives
 * pre-formatted and pre-localized; this component owns no copy and no
 * money math. The `status` maps to the tone of the fill and the badge —
 * derived by the caller from the backend's own percentage and actions,
 * never recomputed here.
 */
interface Props {
  /** Scope heading, e.g. a campaign name or the tenant-wide label. */
  heading: string
  /** The cap's period as a word — "Daily" / "Monthly". */
  periodLabel: string
  /** Pre-formatted "spend of cap" figure, e.g. `¥12,000 of ¥50,000`. */
  spendText: string
  /** Pre-formatted percentage of the cap, e.g. `24%`. */
  percentText: string
  /** Pre-formatted projected spend at the run rate, when the backend sent one. */
  projectedText?: string
  /** Label for the projected figure. */
  projectedLabel?: string
  /** Required freshness sentence for the spend figure. */
  freshnessText: string
  /** The threshold state, derived by the caller from the backend's figures. */
  status: 'ok' | 'warning' | 'hit' | 'stale'
  /** The status as words — "Under cap", "80% — approaching", "Cap reached". */
  statusLabel: string
  /** The exact action configured at the reached threshold, verbatim. */
  actionText?: string
  /** Label for `actionText`. */
  actionLabel?: string
  /** Fraction of the cap consumed, 0–1; drives the fill width only. */
  ratio: number
  class?: string
}

let {
  heading,
  periodLabel,
  spendText,
  percentText,
  projectedText,
  projectedLabel,
  freshnessText,
  status,
  statusLabel,
  actionText,
  actionLabel,
  ratio,
  class: className = '',
}: Props = $props()

const clamped = $derived(Math.min(Math.max(ratio, 0), 1))
const badgeVariant = $derived(
  status === 'hit' ? 'error' : status === 'warning' ? 'warning' : 'neutral',
)
</script>

<section class="sanvi-cap-progress {className}">
  <div class="sanvi-cap-progress__header">
    <h3 class="sanvi-cap-progress__heading">
      {heading}
      <span class="sanvi-cap-progress__period">{periodLabel}</span>
    </h3>
    <Badge variant={badgeVariant}>{statusLabel}</Badge>
  </div>

  <p class="sanvi-cap-progress__spend">
    <span class="sanvi-cap-progress__figure">{spendText}</span>
    <span class="sanvi-cap-progress__percent">{percentText}</span>
  </p>

  <div
    class="sanvi-cap-progress__track sanvi-cap-progress__track--{status}"
    role="progressbar"
    aria-label={heading}
    aria-valuetext={statusLabel}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={Math.round(clamped * 100)}
  >
    <div class="sanvi-cap-progress__fill" style:--sanvi-cap-progress-ratio={clamped}></div>
  </div>

  <dl class="sanvi-cap-progress__meta">
    {#if projectedText}
      <div class="sanvi-cap-progress__meta-row">
        <dt>{projectedLabel}</dt>
        <dd>{projectedText}</dd>
      </div>
    {/if}
    {#if actionText}
      <div class="sanvi-cap-progress__meta-row">
        <dt>{actionLabel}</dt>
        <dd>{actionText}</dd>
      </div>
    {/if}
  </dl>

  <p class="sanvi-cap-progress__freshness">{freshnessText}</p>
</section>

<style>
  .sanvi-cap-progress {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
    padding: var(--sanvi-spacing-4);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-background-primary);
  }

  .sanvi-cap-progress__header {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-cap-progress__heading {
    margin: 0;
    font-size: var(--sanvi-font-size-md);
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-cap-progress__period {
    margin-inline-start: var(--sanvi-spacing-2);
    font-size: var(--sanvi-font-size-sm);
    font-weight: var(--sanvi-font-weight-regular);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-cap-progress__spend {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-cap-progress__figure {
    font-size: var(--sanvi-font-size-lg);
    font-weight: var(--sanvi-font-weight-semibold);
    font-variant-numeric: tabular-nums;
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-cap-progress__percent {
    font-variant-numeric: tabular-nums;
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-cap-progress__track {
    inline-size: 100%;
    block-size: var(--sanvi-spacing-2);
    border-radius: var(--sanvi-radius-full);
    background: var(--sanvi-color-background-tertiary);
    overflow: hidden;
  }

  .sanvi-cap-progress__fill {
    block-size: 100%;
    inline-size: calc(var(--sanvi-cap-progress-ratio) * 100%);
    border-radius: var(--sanvi-radius-full);
    background: var(--sanvi-color-solid-primary-base);
  }

  .sanvi-cap-progress__track--warning .sanvi-cap-progress__fill {
    background: var(--sanvi-color-status-warning);
  }

  .sanvi-cap-progress__track--hit .sanvi-cap-progress__fill {
    background: var(--sanvi-color-status-error);
  }

  .sanvi-cap-progress__track--stale .sanvi-cap-progress__fill {
    background: var(--sanvi-color-text-secondary);
  }

  .sanvi-cap-progress__meta {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-1);
  }

  .sanvi-cap-progress__meta-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-cap-progress__meta dt {
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-cap-progress__meta dd {
    margin: 0;
    font-variant-numeric: tabular-nums;
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-cap-progress__freshness {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }
</style>
