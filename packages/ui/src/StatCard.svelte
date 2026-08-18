<script lang="ts">
import type { Snippet } from 'svelte'

interface Props {
  label: string
  value: string
  description?: string
  trend?: Snippet
  variant?: 'neutral' | 'success' | 'warning' | 'error'
  class?: string
}

let {
  label,
  value,
  description,
  trend,
  variant = 'neutral',
  class: className = '',
}: Props = $props()
</script>

<div class="sanvi-stat-card sanvi-stat-card--{variant} {className}">
  <p class="sanvi-stat-card__label">{label}</p>
  <p class="sanvi-stat-card__value">{value}</p>
  {#if description}<p class="sanvi-stat-card__description">{description}</p>{/if}
  {#if trend}<div class="sanvi-stat-card__trend">{@render trend()}</div>{/if}
</div>

<style>
  .sanvi-stat-card {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-1);
    padding: var(--sanvi-spacing-4);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-md);
    border-inline-start: var(--sanvi-border-width-thick) solid var(--sanvi-color-border-default);
  }

  .sanvi-stat-card--success {
    border-inline-start-color: var(--sanvi-color-status-success);
  }
  .sanvi-stat-card--warning {
    border-inline-start-color: var(--sanvi-color-status-warning);
  }
  .sanvi-stat-card--error {
    border-inline-start-color: var(--sanvi-color-status-error);
  }

  .sanvi-stat-card__label {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-stat-card__value {
    margin: 0;
    font-size: var(--sanvi-font-size-xl);
    font-weight: var(--sanvi-font-weight-semibold);
    font-variant-numeric: tabular-nums;
  }

  .sanvi-stat-card__description {
    margin: 0;
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-stat-card__trend {
    margin-block-start: var(--sanvi-spacing-1);
    font-size: var(--sanvi-font-size-xs);
  }
</style>
