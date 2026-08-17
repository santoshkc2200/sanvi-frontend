<script lang="ts">
import type { Snippet } from 'svelte'

interface Props {
  open?: boolean
  titleText: string
  closeLabel?: string
  class?: string
  children: Snippet
  footer?: Snippet
}

let {
  open = $bindable(false),
  titleText,
  closeLabel = 'Close',
  class: className = '',
  children,
  footer,
}: Props = $props()

let dialogEl: HTMLDialogElement | undefined = $state()
const uid = $props.id()

// <dialog> owns the focus trap, top-layer stacking, and Escape-to-close —
// no hand-rolled keydown handler needed. `open` stays the source of truth
// so a parent can close the dialog by setting a bound prop, not just by
// clicking inside it.
$effect(() => {
  if (!dialogEl) return
  if (open && !dialogEl.open) dialogEl.showModal()
  else if (!open && dialogEl.open) dialogEl.close()
})

function handleNativeClose(): void {
  open = false
}

function handleBackdropClick(event: MouseEvent): void {
  if (event.target === dialogEl) dialogEl?.close()
}
</script>

<dialog
  bind:this={dialogEl}
  class="sanvi-dialog {className}"
  aria-labelledby="{uid}-title"
  onclose={handleNativeClose}
  onclick={handleBackdropClick}
>
  <div class="sanvi-dialog__header">
    <h2 id="{uid}-title" class="sanvi-dialog__title">{titleText}</h2>
    <button
      type="button"
      class="sanvi-dialog__close"
      aria-label={closeLabel}
      onclick={() => dialogEl?.close()}
    >
      &times;
    </button>
  </div>
  <div class="sanvi-dialog__body">
    {@render children()}
  </div>
  {#if footer}
    <div class="sanvi-dialog__footer">
      {@render footer()}
    </div>
  {/if}
</dialog>

<style>
  .sanvi-dialog {
    width: min(32rem, calc(100vw - var(--sanvi-spacing-8)));
    padding: 0;
    border: none;
    border-radius: var(--sanvi-radius-lg);
    background: var(--sanvi-color-background-primary);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-dialog::backdrop {
    /* Scrim overlay: theme-invariant by design (always dims toward black,
       light or dark mode), so it's not one of design-tokens' semantic
       colors. Revisit if phase 07 adds an overlay token. */
    background: rgb(0 0 0 / 0.5); /* sanvi-tokens-ignore */
  }

  .sanvi-dialog__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sanvi-spacing-4);
    padding: var(--sanvi-spacing-4);
    border-block-end: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
  }

  .sanvi-dialog__title {
    margin: 0;
    font-size: var(--sanvi-font-size-lg);
    font-weight: var(--sanvi-font-weight-semibold);
  }

  .sanvi-dialog__close {
    border: none;
    background: transparent;
    color: var(--sanvi-color-text-secondary);
    font-size: var(--sanvi-font-size-xl);
    line-height: 1;
    cursor: pointer;
    padding: var(--sanvi-spacing-1);
    border-radius: var(--sanvi-radius-sm);
  }
  .sanvi-dialog__close:hover {
    background: var(--sanvi-color-background-secondary);
  }

  .sanvi-dialog__body {
    padding: var(--sanvi-spacing-4);
  }

  .sanvi-dialog__footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--sanvi-spacing-2);
    padding: var(--sanvi-spacing-4);
    border-block-start: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
  }
</style>
