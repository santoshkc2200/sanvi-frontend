<script lang="ts">
import type { Snippet } from 'svelte'
import Spinner from './Spinner.svelte'

interface Props {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  /** Shows a spinner and sets `aria-busy`; the button stays focusable but clicks are ignored. */
  loading?: boolean
  /** Visually hidden text announced instead of the label while `loading` is true. */
  loadingLabel?: string
  /**
   * Inert but focusable: sets `aria-disabled` and ignores clicks without the native
   * `disabled` attribute. Prefer this over `disabled` whenever the reason is explained
   * elsewhere on screen — a natively disabled button is skipped by keyboard navigation,
   * so a screen-reader user never reaches the explanation.
   */
  ariaDisabled?: boolean
  /** Id of the element describing this button, e.g. the text explaining why it is inert. */
  ariaDescribedby?: string
  fullWidth?: boolean
  onclick?: (event: MouseEvent) => void
  class?: string
  title?: string
  children: Snippet
}

let {
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled = false,
  loading = false,
  loadingLabel = 'Loading',
  ariaDisabled = false,
  ariaDescribedby,
  fullWidth = false,
  onclick,
  class: className = '',
  title,
  children,
}: Props = $props()

function handleClick(event: MouseEvent): void {
  if (loading || ariaDisabled) {
    event.preventDefault()
    return
  }
  onclick?.(event)
}
</script>

<button
  {type}
  {title}
  class="sanvi-button sanvi-button--{variant} sanvi-button--{size} {className}"
  class:sanvi-button--full={fullWidth}
  class:sanvi-button--inert={ariaDisabled}
  disabled={disabled || loading}
  aria-busy={loading || undefined}
  aria-disabled={ariaDisabled || undefined}
  aria-describedby={ariaDescribedby}
  onclick={handleClick}
>
  {#if loading}
    <Spinner size="sm" />
    <span class="sanvi-visually-hidden">{loadingLabel}</span>
  {/if}
  <span class:sanvi-button__label--loading={loading}>
    {@render children()}
  </span>
</button>

<style>
  .sanvi-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--sanvi-spacing-2);
    border-radius: var(--sanvi-radius-md);
    border: var(--sanvi-border-width-thin) solid transparent;
    font-weight: var(--sanvi-font-weight-medium);
    line-height: var(--sanvi-line-height-tight);
    cursor: pointer;
    transition: background-color 0.12s ease;
  }

  .sanvi-button:disabled,
  .sanvi-button--inert {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .sanvi-button--full {
    width: 100%;
  }

  .sanvi-button--sm {
    padding: var(--sanvi-spacing-1) var(--sanvi-spacing-3);
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-button--md {
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-4);
    font-size: var(--sanvi-font-size-md);
  }

  .sanvi-button--lg {
    padding: var(--sanvi-spacing-3) var(--sanvi-spacing-6);
    font-size: var(--sanvi-font-size-lg);
  }

  .sanvi-button--primary {
    background: var(--sanvi-color-solid-primary-base);
    color: var(--sanvi-color-text-inverse);
  }
  .sanvi-button--primary:not(:disabled):not(.sanvi-button--inert):hover {
    background: var(--sanvi-color-solid-primary-hover);
  }

  .sanvi-button--secondary {
    background: var(--sanvi-color-solid-secondary-base);
    color: var(--sanvi-color-text-inverse);
  }
  .sanvi-button--secondary:not(:disabled):not(.sanvi-button--inert):hover {
    background: var(--sanvi-color-solid-secondary-hover);
  }

  .sanvi-button--danger {
    background: var(--sanvi-color-solid-danger-base);
    color: var(--sanvi-color-text-inverse);
  }
  .sanvi-button--danger:not(:disabled):not(.sanvi-button--inert):hover {
    background: var(--sanvi-color-solid-danger-hover);
  }

  .sanvi-button--ghost {
    background: transparent;
    color: var(--sanvi-color-text-primary);
    border-color: var(--sanvi-color-border-default);
  }
  .sanvi-button--ghost:not(:disabled):not(.sanvi-button--inert):hover {
    background: var(--sanvi-color-background-secondary);
  }

  .sanvi-button__label--loading {
    opacity: 0.7;
  }

  .sanvi-visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
