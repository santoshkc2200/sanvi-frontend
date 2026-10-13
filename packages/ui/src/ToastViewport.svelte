<script lang="ts">
import { dismissToast, getToasts, pauseToast, resumeToast } from './toast.svelte'

interface Props {
  dismissLabel?: string
  class?: string
}

let { dismissLabel = 'Dismiss', class: className = '' }: Props = $props()

const urgent = $derived(
  getToasts().filter((toast) => toast.variant === 'error' || toast.variant === 'warning'),
)
const calm = $derived(
  getToasts().filter((toast) => toast.variant === 'info' || toast.variant === 'success'),
)

const pauseReasons = new WeakMap<EventTarget, Set<string>>()

function pause(event: Event, id: string): void {
  const target = event.currentTarget
  if (!target) return
  const reasons = pauseReasons.get(target) ?? new Set<string>()
  reasons.add(event.type === 'focusin' ? 'focus' : 'pointer')
  pauseReasons.set(target, reasons)
  pauseToast(id)
}
function resume(event: Event, id: string): void {
  const target = event.currentTarget
  if (!target) return
  // A focus move between controls inside the toast is still paused.
  if (
    event instanceof FocusEvent &&
    event.relatedTarget instanceof Node &&
    target instanceof Node &&
    target.contains(event.relatedTarget)
  )
    return
  const reasons = pauseReasons.get(target)
  reasons?.delete(event.type === 'focusout' ? 'focus' : 'pointer')
  if (!reasons?.size) resumeToast(id)
}
</script>

<!--
  Two regions by urgency: errors and warnings announce assertively (a polite
  announcement of "your save failed" arrives after the user has moved on),
  info/success stay polite. Within a region, one live region for all toasts
  of that urgency: screen readers announce additions as they happen, and
  toasts are visually and structurally grouped so keyboard/AT users can find
  and dismiss them.
-->
<div class="sanvi-toast-viewport {className}">
  <div class="sanvi-toast-viewport__region" aria-live="assertive" aria-atomic="false">
    {#each urgent as toast (toast.id)}
      <div
        class="sanvi-toast sanvi-toast--{toast.variant}"
        role="alert"
        onpointerenter={(event) => pause(event, toast.id)}
        onpointerleave={(event) => resume(event, toast.id)}
        onfocusin={(event) => pause(event, toast.id)}
        onfocusout={(event) => resume(event, toast.id)}
      >
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
  <div class="sanvi-toast-viewport__region" aria-live="polite" aria-atomic="false">
    {#each calm as toast (toast.id)}
      <div
        class="sanvi-toast sanvi-toast--{toast.variant}"
        role="status"
        onpointerenter={(event) => pause(event, toast.id)}
        onpointerleave={(event) => resume(event, toast.id)}
        onfocusin={(event) => pause(event, toast.id)}
        onfocusout={(event) => resume(event, toast.id)}
      >
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

  .sanvi-toast-viewport__region {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
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
