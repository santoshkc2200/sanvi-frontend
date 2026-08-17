<script lang="ts">
import type { Snippet } from 'svelte'

interface Props {
  open?: boolean
  titleText: string
  closeLabel?: string
  /** Edge the panel slides in from. */
  side?: 'start' | 'end'
  class?: string
  children: Snippet
}

let {
  open = $bindable(false),
  titleText,
  closeLabel = 'Close',
  side = 'end',
  class: className = '',
  children,
}: Props = $props()

let dialogEl: HTMLDialogElement | undefined = $state()
const uid = $props.id()

// Same native-<dialog> foundation as Dialog (focus trap, top layer,
// Escape-to-close) — only the CSS differs, from a centered card to a
// full-height edge panel.
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
  class="sanvi-drawer sanvi-drawer--{side} {className}"
  aria-labelledby="{uid}-title"
  onclose={handleNativeClose}
  onclick={handleBackdropClick}
>
  <div class="sanvi-drawer__header">
    <h2 id="{uid}-title" class="sanvi-drawer__title">{titleText}</h2>
    <button
      type="button"
      class="sanvi-drawer__close"
      aria-label={closeLabel}
      onclick={() => dialogEl?.close()}
    >
      &times;
    </button>
  </div>
  <div class="sanvi-drawer__body">
    {@render children()}
  </div>
</dialog>

<style>
  .sanvi-drawer {
    position: fixed;
    inset-block: 0;
    margin: 0;
    /* 24rem: not a spacing-scale value — this is a panel width, a distinct
       sizing concept the token set doesn't model yet. 100vw: no fallback
       needed, never a design color/spacing decision. */
    max-width: min(24rem, 100vw); /* sanvi-tokens-ignore */
    width: 100%;
    height: 100%;
    padding: 0;
    border: none;
    background: var(--sanvi-color-background-primary);
    color: var(--sanvi-color-text-primary);
    display: flex;
    flex-direction: column;
  }

  .sanvi-drawer--end {
    inset-inline-end: 0;
    inset-inline-start: auto;
  }

  .sanvi-drawer--start {
    inset-inline-start: 0;
    inset-inline-end: auto;
  }

  .sanvi-drawer::backdrop {
    /* Scrim overlay — see Dialog.svelte's identical rule for why this is
       theme-invariant and not a design-tokens color. */
    background: rgb(0 0 0 / 0.5); /* sanvi-tokens-ignore */
  }

  .sanvi-drawer__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    gap: var(--sanvi-spacing-4);
    padding: var(--sanvi-spacing-4);
    border-block-end: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
  }

  .sanvi-drawer__title {
    margin: 0;
    font-size: var(--sanvi-font-size-lg);
    font-weight: var(--sanvi-font-weight-semibold);
  }

  .sanvi-drawer__close {
    border: none;
    background: transparent;
    color: var(--sanvi-color-text-secondary);
    font-size: var(--sanvi-font-size-xl);
    line-height: 1;
    cursor: pointer;
    padding: var(--sanvi-spacing-1);
    border-radius: var(--sanvi-radius-sm);
  }
  .sanvi-drawer__close:hover {
    background: var(--sanvi-color-background-secondary);
  }

  .sanvi-drawer__body {
    padding: var(--sanvi-spacing-4);
    overflow-y: auto;
    /* Fills the remaining height below the (flex-shrink: 0) header — no
       magic-number height subtraction needed. */
    flex: 1;
    min-height: 0;
  }
</style>
