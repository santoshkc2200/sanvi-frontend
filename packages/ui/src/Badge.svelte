<script lang="ts">
import type { Snippet } from 'svelte'

interface Props {
  variant?: 'neutral' | 'info' | 'success' | 'warning' | 'error'
  class?: string
  children: Snippet
}

let { variant = 'neutral', class: className = '', children }: Props = $props()
</script>

<span class="sanvi-badge sanvi-badge--{variant} {className}">
  {@render children()}
</span>

<style>
  .sanvi-badge {
    display: inline-flex;
    align-items: center;
    padding: var(--sanvi-spacing-1) var(--sanvi-spacing-2);
    border-radius: var(--sanvi-radius-full);
    font-size: var(--sanvi-font-size-xs);
    font-weight: var(--sanvi-font-weight-semibold);
    line-height: var(--sanvi-line-height-tight);
  }

  /* Neutral is the only variant on the neutral surface — text.secondary
     clears 4.5:1 there in both themes. Every colored variant instead uses a
     solid fill + text.inverse: at badge-text size (12px) the 600-tier status
     colors don't clear 4.5:1 against a tinted neutral surface in every
     theme (verified in ui-tokens-contrast.test.mjs), so this reuses the
     same solid-fill approach as Button rather than a tinted background. */
  .sanvi-badge--neutral {
    background: var(--sanvi-color-background-tertiary);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-badge--info {
    background: var(--sanvi-color-solid-primary-base);
    color: var(--sanvi-color-text-inverse);
  }

  .sanvi-badge--success {
    background: var(--sanvi-color-solid-success-base);
    color: var(--sanvi-color-text-inverse);
  }

  .sanvi-badge--warning {
    background: var(--sanvi-color-solid-warning-base);
    color: var(--sanvi-color-text-inverse);
  }

  .sanvi-badge--error {
    background: var(--sanvi-color-solid-danger-base);
    color: var(--sanvi-color-text-inverse);
  }
</style>
