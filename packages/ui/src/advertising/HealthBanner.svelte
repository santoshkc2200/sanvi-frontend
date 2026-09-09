<script lang="ts">
import Button from '../Button.svelte'

/**
 * The conversion-diagnostics health banner (phase 10, TASK-015).
 *
 * Shows each health figure as its own labelled entry with its own copy —
 * suppression share and upload failure ratio are different conversations
 * ("a working privacy system" vs. "an incident") and must never collapse
 * into one number or one sentence, nor be distinguished by colour alone.
 * Every figure arrives pre-formatted and pre-localized from the caller;
 * this component is presentational by the labels-as-data rule.
 */
export interface AdHealthFigure {
  /** Stable key for the `each` binding and for tests. */
  key: string
  /** Pre-formatted value as it should read, e.g. `38%` or `2 of 9`. */
  value: string
  /** The figure's own label, e.g. "Suppression share". */
  label: string
  /** The figure's own sentence — what it means and what, if anything, to do. */
  description: string
}

interface Props {
  title: string
  figures: AdHealthFigure[]
  tone?: 'warning' | 'error'
  actionLabel?: string
  onAction?: () => void
  class?: string
}

let {
  title,
  figures,
  tone = 'warning',
  actionLabel,
  onAction,
  class: className = '',
}: Props = $props()

const headingId = $props.id()
</script>

<section class="sanvi-ad-health-banner sanvi-ad-health-banner--{tone} {className}" aria-labelledby={headingId}>
  <h3 id={headingId} class="sanvi-ad-health-banner__title">{title}</h3>
  <dl class="sanvi-ad-health-banner__figures">
    {#each figures as figure (figure.key)}
      <div class="sanvi-ad-health-banner__figure">
        <dt class="sanvi-ad-health-banner__figure-label">{figure.label}</dt>
        <dd class="sanvi-ad-health-banner__figure-body">
          <span class="sanvi-ad-health-banner__figure-value">{figure.value}</span>
          <span class="sanvi-ad-health-banner__figure-description">{figure.description}</span>
        </dd>
      </div>
    {/each}
  </dl>
  {#if actionLabel && onAction}
    <Button variant="secondary" size="sm" onclick={onAction}>{actionLabel}</Button>
  {/if}
</section>

<style>
  .sanvi-ad-health-banner {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-3);
    padding: var(--sanvi-spacing-4);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-background-secondary);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-ad-health-banner--warning {
    border-inline-start: var(--sanvi-border-width-thick) solid var(--sanvi-color-status-warning);
  }

  .sanvi-ad-health-banner--error {
    border-inline-start: var(--sanvi-border-width-thick) solid var(--sanvi-color-status-error);
  }

  .sanvi-ad-health-banner__title {
    margin: 0;
    font-size: var(--sanvi-font-size-md);
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-ad-health-banner__figures {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-ad-health-banner__figure {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-1);
  }

  .sanvi-ad-health-banner__figure-label {
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-ad-health-banner__figure-body {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--sanvi-spacing-2);
    align-items: baseline;
  }

  .sanvi-ad-health-banner__figure-value {
    font-size: var(--sanvi-font-size-lg);
    font-weight: var(--sanvi-font-weight-semibold);
    font-variant-numeric: tabular-nums;
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-ad-health-banner__figure-description {
    color: var(--sanvi-color-text-secondary);
  }
</style>
