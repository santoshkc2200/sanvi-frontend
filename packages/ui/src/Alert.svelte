<script lang="ts">
import type { Snippet } from 'svelte'

interface Props {
  variant?: 'info' | 'success' | 'warning' | 'error'
  title?: string
  class?: string
  children: Snippet
}

let { variant = 'info', title, class: className = '', children }: Props = $props()

// Warning/error interrupt (assertive); info/success just report (polite) —
// matches the urgency a screen reader user actually needs.
const role = $derived(variant === 'error' || variant === 'warning' ? 'alert' : 'status')
// Only an *error* alert is a terminal async state (TASK-023's marker
// contract); a warning is a condition, not a failure.
const asyncState = $derived(variant === 'error' ? 'error' : undefined)
</script>

<div class="sanvi-alert sanvi-alert--{variant} {className}" {role} data-async-state={asyncState}>
  {#if title}
    <p class="sanvi-alert__title">{title}</p>
  {/if}
  <div class="sanvi-alert__body">
    {@render children()}
  </div>
</div>

<style>
  .sanvi-alert {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-1);
    padding: var(--sanvi-spacing-3) var(--sanvi-spacing-4);
    border-radius: var(--sanvi-radius-md);
    border-inline-start: var(--sanvi-border-width-thick) solid;
    background: var(--sanvi-color-background-secondary);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-alert--info {
    border-inline-start-color: var(--sanvi-color-primary-base);
  }
  .sanvi-alert--success {
    border-inline-start-color: var(--sanvi-color-status-success);
  }
  .sanvi-alert--warning {
    border-inline-start-color: var(--sanvi-color-status-warning);
  }
  .sanvi-alert--error {
    border-inline-start-color: var(--sanvi-color-status-error);
  }

  .sanvi-alert__title {
    margin: 0;
    font-weight: var(--sanvi-font-weight-semibold);
  }

  .sanvi-alert__body {
    font-size: var(--sanvi-font-size-sm);
  }
</style>
