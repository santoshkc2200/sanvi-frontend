<script lang="ts">
import Button from './Button.svelte'
import Dialog from './Dialog.svelte'
import Field from './Field.svelte'
import Textarea from './Textarea.svelte'

interface Props {
  open?: boolean
  titleText: string
  description?: string
  reasonLabel?: string
  reasonPlaceholder?: string
  confirmLabel?: string
  cancelLabel?: string
  minReasonLength?: number
  submitting?: boolean
  errorMessage?: string
  onConfirm: (reason: string) => void | Promise<void>
  onCancel?: () => void
}

let {
  open = $bindable(false),
  titleText,
  description,
  reasonLabel = 'Reason',
  reasonPlaceholder,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  minReasonLength = 10,
  submitting = false,
  errorMessage,
  onConfirm,
  onCancel,
}: Props = $props()

let reason = $state('')

const canConfirm = $derived(reason.trim().length >= minReasonLength && !submitting)

function handleCancel(): void {
  open = false
  onCancel?.()
}

async function handleConfirm(): Promise<void> {
  if (!canConfirm) return
  await onConfirm(reason.trim())
}

$effect(() => {
  if (open) reason = ''
})
</script>

<Dialog bind:open {titleText}>
  {#snippet children()}
    <div class="sanvi-reason-prompt">
      {#if description}<p>{description}</p>{/if}
      {#if errorMessage}<p class="sanvi-reason-prompt__error" role="alert">{errorMessage}</p>{/if}
      <Field label={reasonLabel} required>
        {#snippet children({ id })}
          <Textarea {id} bind:value={reason} placeholder={reasonPlaceholder} required />
        {/snippet}
      </Field>
    </div>
  {/snippet}
  {#snippet footer()}
    <Button variant="ghost" onclick={handleCancel}>{cancelLabel}</Button>
    <Button variant="primary" disabled={!canConfirm} loading={submitting} onclick={handleConfirm}>
      {confirmLabel}
    </Button>
  {/snippet}
</Dialog>

<style>
  .sanvi-reason-prompt {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-3);
  }

  .sanvi-reason-prompt__error {
    color: var(--sanvi-color-status-error);
    font-size: var(--sanvi-font-size-sm);
    margin: 0;
  }
</style>
