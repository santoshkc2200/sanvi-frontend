<script lang="ts">
import Alert from './Alert.svelte'
import Button from './Button.svelte'
import Dialog from './Dialog.svelte'
import Field from './Field.svelte'
import Input from './Input.svelte'
import Stack from './layout/Stack.svelte'
import Textarea from './Textarea.svelte'
import Select, { type SelectOption } from './Select.svelte'

interface Props {
  open?: boolean
  titleText: string
  /** The explicit, specific consequence of this action — never a generic "are you sure?". */
  consequence: string
  /** When set, the confirm button stays disabled until the operator types this exact string — for the actions where a misclick is the worst kind of mistake. */
  confirmationPhrase?: string
  confirmationLabel?: string
  reasonLabel?: string
  reasonPlaceholder?: string
  minReasonLength?: number
  /**
   * When set, the reason is chosen from this machine-readable vocabulary
   * (e.g. a backend that validates `billing | abuse | legal | operational`)
   * instead of free text — the confirm button stays disabled until one is
   * picked, and `onConfirm` receives the option's `value`.
   */
  reasonOptions?: SelectOption[]
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning'
  submitting?: boolean
  errorMessage?: string
  onConfirm: (reason: string) => void | Promise<void>
  onCancel?: () => void
}

let {
  open = $bindable(false),
  titleText,
  consequence,
  confirmationPhrase,
  confirmationLabel = 'Type to confirm',
  reasonLabel = 'Reason',
  reasonPlaceholder,
  minReasonLength = 10,
  reasonOptions,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  submitting = false,
  errorMessage,
  onConfirm,
  onCancel,
}: Props = $props()

let reason = $state('')
let typedConfirmation = $state('')

const phraseMatches = $derived(!confirmationPhrase || typedConfirmation === confirmationPhrase)
const reasonValid = $derived(
  reasonOptions ? reason !== '' : reason.trim().length >= minReasonLength,
)
const canConfirm = $derived(reasonValid && phraseMatches && !submitting)

function handleCancel(): void {
  open = false
  onCancel?.()
}

async function handleConfirm(): Promise<void> {
  if (!canConfirm) return
  await onConfirm(reason.trim())
}

$effect(() => {
  if (open) {
    reason = ''
    typedConfirmation = ''
  }
})
</script>

<Dialog bind:open {titleText}>
  {#snippet children()}
    <Stack gap="4">
      <Alert variant={variant === 'danger' ? 'error' : 'warning'}>{consequence}</Alert>
      {#if errorMessage}
        <Alert variant="error">{errorMessage}</Alert>
      {/if}
      {#if reasonOptions}
        <Field label={reasonLabel} required>
          {#snippet children({ id })}
            <Select
              {id}
              bind:value={reason}
              options={reasonOptions}
              placeholder={reasonPlaceholder}
              clearable
              required
            />
          {/snippet}
        </Field>
      {:else}
        <Field label={reasonLabel} required>
          {#snippet children({ id })}
          <Textarea {id} bind:value={reason} placeholder={reasonPlaceholder} required />
          {/snippet}
        </Field>
      {/if}
      {#if confirmationPhrase}
        <Field label="{confirmationLabel}: “{confirmationPhrase}”" required>
          {#snippet children({ id })}
            <Input {id} bind:value={typedConfirmation} required />
          {/snippet}
        </Field>
      {/if}
    </Stack>
  {/snippet}
  {#snippet footer()}
    <Button variant="ghost" onclick={handleCancel}>{cancelLabel}</Button>
    <Button variant={variant === 'danger' ? 'danger' : 'primary'} disabled={!canConfirm} loading={submitting} onclick={handleConfirm}>
      {confirmLabel}
    </Button>
  {/snippet}
</Dialog>
