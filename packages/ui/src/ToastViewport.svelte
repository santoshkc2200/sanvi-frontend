<script lang="ts">
import { dismissToast, getToasts } from './toast.svelte'

interface Props {
  dismissLabel?: string
  class?: string
}

let { dismissLabel = 'Dismiss', class: className = '' }: Props = $props()
</script>

<!--
  A single region, not one live region per toast: screen readers announce
  additions to this region as they happen, and toasts are visually and
  structurally grouped so keyboard/AT users can find and dismiss them.
-->
<div class="sanvi-toast-viewport {className}" aria-live="polite" aria-atomic="false">
  {#each getToasts() as toast (toast.id)}
    <div class="sanvi-toast sanvi-toast--{toast.variant}" role="status">
      <div class="sanvi-toast__content">
        <p class="sanvi-toast__title">{toast.title}</p>
        {#if toast.description}
          <p class="sanvi-toast__description">{toast.description}</p>
        {/if}
      </div>
      <button
        type="button"
        class="sanvi-toast__dismiss"
        aria-label={dismissLabel}
        onclick={() => dismissToast(toast.id)}
      >
        &times;
      </button>
    </div>
  {/each}
</div>

<style>
  .sanvi-toast-viewport {
    position: fixed;
    inset-block-end: var(--sanvi-spacing-4);
    inset-inline-end: var(--sanvi-spacing-4);
    z-index: var(--sanvi-z-index-toast);
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
    width: min(24rem, calc(100vw - var(--sanvi-spacing-8)));
  }

  .sanvi-toast {
    display: flex;
    align-items: start;
    gap: var(--sanvi-spacing-3);
    padding: var(--sanvi-spacing-3) var(--sanvi-spacing-4);
    border-radius: var(--sanvi-radius-md);
    border-inline-start: var(--sanvi-border-width-thick) solid;
    background: var(--sanvi-color-background-secondary);
    color: var(--sanvi-color-text-primary);
    /* Elevation shadow — no shadow/elevation token exists yet; same
       theme-invariant reasoning as the Dialog/Drawer scrim. */
    box-shadow: 0 4px 12px rgb(0 0 0 / 0.15); /* sanvi-tokens-ignore */
  }

  .sanvi-toast--info {
    border-inline-start-color: var(--sanvi-color-primary-base);
  }
  .sanvi-toast--success {
    border-inline-start-color: var(--sanvi-color-status-success);
  }
  .sanvi-toast--warning {
    border-inline-start-color: var(--sanvi-color-status-warning);
  }
  .sanvi-toast--error {
    border-inline-start-color: var(--sanvi-color-status-error);
  }

  .sanvi-toast__content {
    flex: 1;
    min-width: 0;
  }

  .sanvi-toast__title {
    margin: 0;
    font-weight: var(--sanvi-font-weight-semibold);
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-toast__description {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-toast__dismiss {
    border: none;
    background: transparent;
    color: var(--sanvi-color-text-secondary);
    font-size: var(--sanvi-font-size-lg);
    line-height: 1;
    cursor: pointer;
    padding: var(--sanvi-spacing-1);
    border-radius: var(--sanvi-radius-sm);
  }
  .sanvi-toast__dismiss:hover {
    background: var(--sanvi-color-background-tertiary);
  }
</style>
