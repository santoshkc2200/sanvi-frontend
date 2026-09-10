<script lang="ts">
import Alert from '../Alert.svelte'
import Button from '../Button.svelte'
import Dialog from '../Dialog.svelte'
import Field from '../Field.svelte'
import Input from '../Input.svelte'
import Stack from '../layout/Stack.svelte'

/**
 * The budget-guardrail consequence dialog (phase 10, TASK-017).
 *
 * The one confirmation shape for money-adjacent cap changes: a
 * plain-language consequence statement, the exact figures the decision
 * changes (each as its own labelled row — daily delta, projected monthly
 * delta, the pause figure, the affected campaigns), and — where the
 * consequence stops a tenant's advertising — a typed confirmation whose
 * confirm button stays disabled until the phrase matches exactly.
 *
 * Deliberately not `DangerousAction`: that component requires an audit
 * *reason*, which cap confirmations don't collect — what they must show is
 * the *arithmetic* of the change before it happens. The figures arrive
 * pre-formatted from the caller (labels-as-data); this component owns no
 * copy and no math.
 */
export interface ConsequenceFigure {
  /** Stable key for the `each` binding and for tests. */
  key: string
  /** The figure's label, e.g. "Daily increase". */
  label: string
  /** Pre-formatted value, e.g. `+¥10,000`. */
  value: string
}

interface Props {
  open?: boolean
  titleText: string
  /** The explicit, specific consequence — never a generic "are you sure?". */
  consequence: string
  /** The exact figures this decision changes, each labelled. */
  figures?: ConsequenceFigure[]
  /** When set, confirm stays disabled until the operator types this exact string. */
  confirmationPhrase?: string
  confirmationLabel?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning'
  submitting?: boolean
  errorMessage?: string
  onConfirm: () => void | Promise<void>
  onCancel?: () => void
}

let {
  open = $bindable(false),
  titleText,
  consequence,
  figures = [],
  confirmationPhrase,
  confirmationLabel = 'Type to confirm',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  submitting = false,
  errorMessage,
  onConfirm,
  onCancel,
}: Props = $props()

let typedConfirmation = $state('')

const phraseMatches = $derived(!confirmationPhrase || typedConfirmation === confirmationPhrase)
const canConfirm = $derived(phraseMatches && !submitting)

function handleCancel(): void {
  open = false
  onCancel?.()
}

async function handleConfirm(): Promise<void> {
  if (!canConfirm) return
  await onConfirm()
}

// Reopening starts the phrase empty — a confirmation carried over from a
// previous dialog would let a stale phrase confirm a different figure.
$effect(() => {
  if (open) typedConfirmation = ''
})
</script>

<Dialog bind:open {titleText}>
  {#snippet children()}
    <Stack gap="4">
      <Alert variant={variant === 'danger' ? 'error' : 'warning'}>{consequence}</Alert>
      {#if errorMessage}
        <Alert variant="error">{errorMessage}</Alert>
      {/if}
      {#if figures.length > 0}
        <dl class="sanvi-consequence-dialog__figures">
          {#each figures as figure (figure.key)}
            <div class="sanvi-consequence-dialog__figure">
              <dt>{figure.label}</dt>
              <dd>{figure.value}</dd>
            </div>
          {/each}
        </dl>
      {/if}
      {#if confirmationPhrase}
        <Field label="{confirmationLabel}: “{confirmationPhrase}”" required>
          {#snippet children(control)}
            <Input
              id={control.id}
              bind:value={typedConfirmation}
              autocomplete="off"
              required
              describedBy={control.describedBy}
            />
          {/snippet}
        </Field>
      {/if}
    </Stack>
  {/snippet}
  {#snippet footer()}
    <Button variant="ghost" onclick={handleCancel}>{cancelLabel}</Button>
    <Button
      variant={variant === 'danger' ? 'danger' : 'primary'}
      disabled={!canConfirm}
      loading={submitting}
      onclick={handleConfirm}
    >
      {confirmLabel}
    </Button>
  {/snippet}
</Dialog>

<style>
  .sanvi-consequence-dialog__figures {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-consequence-dialog__figure {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: var(--sanvi-spacing-2);
    border-block-end: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    padding-block-end: var(--sanvi-spacing-2);
  }

  .sanvi-consequence-dialog__figure:last-child {
    border-block-end: none;
    padding-block-end: 0;
  }

  .sanvi-consequence-dialog__figure dt {
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-consequence-dialog__figure dd {
    margin: 0;
    font-weight: var(--sanvi-font-weight-semibold);
    font-variant-numeric: tabular-nums;
    color: var(--sanvi-color-text-primary);
  }
</style>
