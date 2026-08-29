<script lang="ts">
import Button from './Button.svelte'
import Dialog from './Dialog.svelte'

/**
 * The opt-in consent banner (EU/UK/JP). Compliance constraints baked in
 * (phase 05 plan, "Banner design (opt-in)"):
 * - "Reject all" and "Accept all" get identical visual weight — same
 *   variant, same size, side by side. A visual test fails if that changes.
 * - No pre-ticked boxes, no cookie wall: the banner is a non-modal dialog
 *   (`aria-modal="false"`, no backdrop), so screen readers and keyboard
 *   users can still leave it and read the page.
 * - Granular choice ("Choose") is one click away.
 * - A GPC signal is disclosed here, and "Accept all" refuses to act until
 *   the explicit override confirmation has happened.
 */
export interface ConsentBannerPurpose {
  key: string
  label: string
}

interface Props {
  open: boolean
  title: string
  body: string
  purposes: ConsentBannerPurpose[]
  acceptLabel: string
  rejectLabel: string
  chooseLabel: string
  onAcceptAll: (options: { overrideGpc: boolean }) => void
  onRejectAll: () => void
  onChoose: () => void
  /** Set when a browser privacy signal (GPC) was detected and applied. */
  gpcNotice?: string
  gpcOverrideTitle?: string
  gpcOverrideBody?: string
  gpcOverrideConfirmLabel?: string
  gpcOverrideCancelLabel?: string
  /** Accessible label for the override dialog's close (×) button. */
  overrideDialogCloseLabel?: string
  class?: string
}

let {
  open,
  title,
  body,
  purposes,
  acceptLabel,
  rejectLabel,
  chooseLabel,
  onAcceptAll,
  onRejectAll,
  onChoose,
  gpcNotice,
  gpcOverrideTitle = 'Override browser privacy signal?',
  gpcOverrideBody = '',
  gpcOverrideConfirmLabel = 'Accept anyway',
  gpcOverrideCancelLabel = 'Keep signal',
  overrideDialogCloseLabel = 'Close',
  class: className = '',
}: Props = $props()

const uid = $props.id()
const headingId = `sanvi-consent-banner-${uid}`

let container: HTMLElement | undefined = $state()
let overrideDialogOpen = $state(false)

$effect(() => {
  if (open) container?.focus()
})

function accept(): void {
  if (gpcNotice && !overrideDialogOpen) {
    // A browser privacy signal is active — an "accept all" may only pass
    // after an explicit, separate confirmation.
    overrideDialogOpen = true
    return
  }
  overrideDialogOpen = false
  onAcceptAll({ overrideGpc: gpcNotice !== undefined })
}

function reject(): void {
  overrideDialogOpen = false
  onRejectAll()
}
</script>

{#if open}
  
<div
    bind:this={container}
    class="sanvi-consent-banner {className}"
    role="dialog"
    aria-modal="false"
    aria-labelledby={headingId}
    tabindex="-1"
  >
    <h2 class="sanvi-consent-banner__title" id={headingId}>{title}</h2>
    <p class="sanvi-consent-banner__body">{body}</p>
    <ul class="sanvi-consent-banner__purposes">
      {#each purposes as purpose (purpose.key)}
        <li>{purpose.label}</li>
      {/each}
    </ul>
    {#if gpcNotice}
      <p class="sanvi-consent-banner__gpc" role="status">{gpcNotice}</p>
    {/if}
    <div class="sanvi-consent-banner__actions">
      <Button variant="secondary" onclick={reject}>{rejectLabel}</Button>
      <Button variant="secondary" onclick={accept}>{acceptLabel}</Button>
      <Button variant="ghost" size="sm" onclick={onChoose}>{chooseLabel}</Button>
    </div>
  </div>
{/if}

<Dialog
  bind:open={overrideDialogOpen}
  titleText={gpcOverrideTitle}
  closeLabel={overrideDialogCloseLabel}
>
  <p>{gpcOverrideBody}</p>
  {#snippet footer()}
    <div class="sanvi-consent-banner__override-actions">
      <Button variant="secondary" onclick={() => (overrideDialogOpen = false)}>
        {gpcOverrideCancelLabel}
      </Button>
      <Button variant="primary" onclick={accept}>{gpcOverrideConfirmLabel}</Button>
    </div>
  {/snippet}
</Dialog>

<style>
  .sanvi-consent-banner {
    position: fixed;
    inset-inline: 0;
    bottom: 0;
    z-index: var(--sanvi-z-index-modal);
    max-width: 100%;
    margin-inline: auto;
    padding: var(--sanvi-spacing-4);
    background: var(--sanvi-color-background-primary);
    color: var(--sanvi-color-text-primary);
    border-top: var(--sanvi-border-width-thick) solid var(--sanvi-color-border-default);
    box-shadow: 0 0 var(--sanvi-spacing-4) 0 color-mix(in srgb, var(--sanvi-color-text-primary) 25%, transparent);
    outline: none;
  }

  .sanvi-consent-banner__title {
    margin: 0 0 var(--sanvi-spacing-2);
    font-size: var(--sanvi-font-size-lg);
    font-weight: var(--sanvi-font-weight-semibold);
  }

  .sanvi-consent-banner__body {
    margin: 0 0 var(--sanvi-spacing-2);
    font-size: var(--sanvi-font-size-sm);
    line-height: var(--sanvi-line-height-base);
  }

  .sanvi-consent-banner__purposes {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sanvi-spacing-1) var(--sanvi-spacing-3);
    margin: 0 0 var(--sanvi-spacing-3);
    padding: 0;
    list-style: none;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-consent-banner__purposes li::before {
    content: '•';
    margin-inline-end: var(--sanvi-spacing-1);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-consent-banner__gpc {
    margin: 0 0 var(--sanvi-spacing-3);
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-3);
    font-size: var(--sanvi-font-size-sm);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-background-secondary);
  }

  .sanvi-consent-banner__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sanvi-spacing-3);
  }

  .sanvi-consent-banner__override-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--sanvi-spacing-3);
  }
</style>
