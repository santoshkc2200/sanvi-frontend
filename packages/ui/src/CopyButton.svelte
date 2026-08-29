<script lang="ts">
import { onDestroy } from 'svelte'

interface Props {
  value: string
  label?: string
  copiedLabel?: string
  onCopy?: () => void
  size?: 'sm' | 'md'
  variant?: 'primary' | 'secondary' | 'ghost'
  class?: string
}

let {
  value,
  label = 'Copy',
  copiedLabel = 'Copied!',
  onCopy,
  size = 'sm',
  variant = 'ghost',
  class: className = '',
}: Props = $props()

let copied = $state(false)
let timer: ReturnType<typeof setTimeout> | undefined

onDestroy(() => {
  if (timer) clearTimeout(timer)
})

async function handleClick(): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(value)
    }
  } catch {
    // Clipboard write failed or blocked; continue to trigger local state and callback
  }
  copied = true
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    copied = false
  }, 2000)
  onCopy?.()
}
</script>

<button
  type="button"
  class="sanvi-copy-button sanvi-copy-button--{variant} sanvi-copy-button--{size} {className}"
  class:sanvi-copy-button--copied={copied}
  aria-live="polite"
  onclick={handleClick}
>
  {#if copied}
    <svg
      class="sanvi-copy-button__icon"
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <polyline points="3.5 8.5 6.5 11.5 12.5 4.5" />
    </svg>
    <span>{copiedLabel}</span>
  {:else}
    <svg
      class="sanvi-copy-button__icon"
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M3.5 10.5h-1a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v1" />
    </svg>
    <span>{label}</span>
  {/if}
</button>

<style>
  .sanvi-copy-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--sanvi-spacing-1);
    border-radius: var(--sanvi-radius-md);
    border: var(--sanvi-border-width-thin) solid transparent;
    font-weight: var(--sanvi-font-weight-medium);
    line-height: var(--sanvi-line-height-tight);
    cursor: pointer;
    white-space: nowrap;
    transition: background-color 0.12s ease, border-color 0.12s ease, color 0.12s ease;
  }

  .sanvi-copy-button__icon {
    width: var(--sanvi-font-size-sm);
    height: var(--sanvi-font-size-sm);
    flex-shrink: 0;
  }

  .sanvi-copy-button--sm {
    padding: var(--sanvi-spacing-1) var(--sanvi-spacing-2);
    font-size: var(--sanvi-font-size-xs);
  }

  .sanvi-copy-button--md {
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-3);
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-copy-button--primary {
    background: var(--sanvi-color-solid-primary-base);
    color: var(--sanvi-color-text-inverse);
  }

  .sanvi-copy-button--primary:hover {
    background: var(--sanvi-color-solid-primary-hover);
  }

  .sanvi-copy-button--secondary {
    background: var(--sanvi-color-solid-secondary-base);
    color: var(--sanvi-color-text-inverse);
  }

  .sanvi-copy-button--secondary:hover {
    background: var(--sanvi-color-solid-secondary-hover);
  }

  .sanvi-copy-button--ghost {
    background: transparent;
    color: var(--sanvi-color-text-secondary);
    border-color: var(--sanvi-color-border-default);
  }

  .sanvi-copy-button--ghost:hover {
    background: var(--sanvi-color-background-secondary);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-copy-button--copied {
    color: var(--sanvi-color-status-success);
    border-color: var(--sanvi-color-status-success);
  }
</style>
