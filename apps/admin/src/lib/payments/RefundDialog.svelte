<script lang="ts">
import { refundTenantPayment } from '@sanvi/api-client'
import type { PaymentView, RefundRequest, RefundView } from '@sanvi/api-client'
import { can } from '@sanvi/auth'
import { formatMinor, majorToMinor, majorUnitStep, minorToMajor } from '@sanvi/billing-elements'
import { t } from '@sanvi/i18n'
import { getActiveTenantId } from '@sanvi/tenant'
import { Alert, Button, Cluster, Dialog, Field, Input, Select, showToast, Stack } from '@sanvi/ui'
import { apiClient } from '../../lib/api'
import { sumSucceededRefundsMinor } from './helpers'

interface Props {
  open?: boolean
  payment: PaymentView
  refunds?: RefundView[]
  onSuccess?: (refund: RefundView) => void
  onClose?: () => void
}

let { open = $bindable(false), payment, refunds = [], onSuccess, onClose }: Props = $props()

let mode = $state<'full' | 'partial'>('full')
let partialMajor = $state(0)
let reason = $state('')
let note = $state('')
let submitting = $state(false)
let error = $state<string | undefined>(undefined)
let idempotencyKey = $state('')
interface LastAttemptPayload {
  amountMinor: number | undefined
  reason: string
}
let lastFailedAttempt = $state<LastAttemptPayload | undefined>(undefined)

function mintIdempotencyKey(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        const v = c === 'x' ? r : (r & 0x3) | 0x8
        return v.toString(16)
      })
}

const currency = $derived(payment.currency)

const totalRefundedMinor = $derived.by(() => {
  return sumSucceededRefundsMinor(refunds)
})

const currentRefundableMinor = $derived.by(() => {
  return Math.max(0, payment.amount_minor - totalRefundedMinor)
})

const maxPartialMajor = $derived(minorToMajor(currentRefundableMinor, currency))
const step = $derived(majorUnitStep(currency))

const refundMinor = $derived.by(() => {
  if (mode === 'full') return currentRefundableMinor
  return majorToMinor(partialMajor, currency)
})

const remainingAfterRefundMinor = $derived.by(() => {
  return Math.max(0, currentRefundableMinor - refundMinor)
})

const hasPermission = $derived(can('payments.refund', getActiveTenantId()))

const isValid = $derived.by(() => {
  if (!hasPermission) return false
  if (!reason.trim()) return false
  if (refundMinor <= 0) return false
  if (refundMinor > currentRefundableMinor) return false
  return true
})

// Generate the idempotency key once per dialog open lifecycle.
$effect(() => {
  if (open) {
    if (!idempotencyKey) {
      idempotencyKey = mintIdempotencyKey()
    }
    lastFailedAttempt = undefined
    mode = 'full'
    partialMajor = minorToMajor(currentRefundableMinor, currency)
    reason = ''
    note = ''
    submitting = false
    error = undefined
  } else {
    idempotencyKey = ''
    lastFailedAttempt = undefined
    submitting = false
    error = undefined
  }
})

const reasonOptions = $derived([
  { value: 'duplicate', label: t['admin.payments.refund.reasonDuplicate']() },
  { value: 'fraudulent', label: t['admin.payments.refund.reasonFraudulent']() },
  { value: 'requested_by_customer', label: t['admin.payments.refund.reasonRequested']() },
  { value: 'other', label: t['admin.payments.refund.reasonOther']() },
])

async function handleSubmit(): Promise<void> {
  if (!isValid || submitting) return
  submitting = true
  error = undefined

  const submittedAmountMinor = mode === 'partial' ? refundMinor : undefined
  const submittedReason = reason.trim()

  if (lastFailedAttempt) {
    const isDifferent =
      lastFailedAttempt.amountMinor !== submittedAmountMinor ||
      lastFailedAttempt.reason !== submittedReason
    if (isDifferent) {
      idempotencyKey = mintIdempotencyKey()
    }
  }

  const payload: RefundRequest = {
    reason,
    note: note.trim() ? note.trim() : undefined,
    amount:
      mode === 'partial'
        ? {
            currency,
            minor_units: refundMinor,
          }
        : undefined,
  }

  try {
    const refund = await refundTenantPayment(apiClient, payment.id, payload, idempotencyKey)
    showToast({
      title: t['admin.payments.refund.successToast']({
        amount: formatMinor(refund.amount_minor, refund.currency),
      }),
      variant: 'success',
    })
    open = false
    lastFailedAttempt = undefined
    onSuccess?.(refund)
    onClose?.()
  } catch (err) {
    lastFailedAttempt = {
      amountMinor: submittedAmountMinor,
      reason: submittedReason,
    }
    if (
      err &&
      typeof err === 'object' &&
      'message' in err &&
      typeof (err as { message: unknown }).message === 'string'
    ) {
      error = (err as { message: string }).message
    } else {
      error = t['admin.payments.refund.genericError']()
    }
  } finally {
    submitting = false
  }
}

function handleClose(): void {
  open = false
  onClose?.()
}
</script>

{#if open}
  <Dialog bind:open titleText={t['admin.payments.refund.dialogTitle']()}>
    {#snippet children()}
      <Stack gap="4">
        {#if !hasPermission}
          <Alert variant="error">
            {t['admin.payments.refund.permissionDenied']()}
          </Alert>
        {/if}

        {#if error}
          <Alert variant="error">
            {error}
          </Alert>
        {/if}

        <!-- Live announcement for screen readers -->
        <span class="sanvi-visually-hidden" role="status" aria-live="polite">
          {t['admin.payments.refund.refundAmountDisplay']()}: {formatMinor(refundMinor, currency)}
        </span>

        <div class="sanvi-refund-dialog__summary">
          <div class="sanvi-refund-dialog__summary-row">
            <span>{t['admin.payments.refund.currentBalance']()}</span>
            <strong>{formatMinor(currentRefundableMinor, currency)}</strong>
          </div>
          <div class="sanvi-refund-dialog__summary-row sanvi-refund-dialog__summary-row--highlight">
            <span>{t['admin.payments.refund.refundAmountDisplay']()}</span>
            <strong class="sanvi-refund-dialog__amount-strong">{formatMinor(refundMinor, currency)}</strong>
          </div>
          <div class="sanvi-refund-dialog__summary-row">
            <span>{t['admin.payments.refund.remainingBalanceAfter']()}</span>
            <span>{formatMinor(remainingAfterRefundMinor, currency)}</span>
          </div>
        </div>

        <Field label={t['admin.payments.refund.mode']()} required>
          {#snippet children()}
            <Cluster gap="4">
              <label class="sanvi-refund-dialog__radio-label">
                <input
                  type="radio"
                  name="refund-mode"
                  value="full"
                  checked={mode === 'full'}
                  disabled={submitting || !hasPermission}
                  onchange={() => {
                    mode = 'full'
                  }}
                />
                <span>{t['admin.payments.refund.full']({ amount: formatMinor(currentRefundableMinor, currency) })}</span>
              </label>
              <label class="sanvi-refund-dialog__radio-label">
                <input
                  type="radio"
                  name="refund-mode"
                  value="partial"
                  checked={mode === 'partial'}
                  disabled={submitting || !hasPermission}
                  onchange={() => {
                    mode = 'partial'
                    if (partialMajor <= 0) {
                      partialMajor = maxPartialMajor
                    }
                  }}
                />
                <span>{t['admin.payments.refund.partial']()}</span>
              </label>
            </Cluster>
          {/snippet}
        </Field>

        {#if mode === 'partial'}
          <Field label={t['admin.payments.refund.amountLabel']()} required>
            {#snippet children(controlProps)}
              <input
                {...controlProps}
                type="number"
                min={step}
                max={maxPartialMajor}
                step={step}
                class="sanvi-refund-dialog__number-input"
                bind:value={partialMajor}
                disabled={submitting || !hasPermission}
              />
            {/snippet}
          </Field>
          {#if refundMinor > currentRefundableMinor}
            <Alert variant="error">
              {t['admin.payments.refund.amountExceedsRemaining']({ amount: formatMinor(currentRefundableMinor, currency) })}
            </Alert>
          {/if}
          {#if refundMinor <= 0}
            <Alert variant="error">
              {t['admin.payments.refund.amountMustBePositive']()}
            </Alert>
          {/if}
        {/if}

        <Field label={t['admin.payments.refund.reasonLabel']()} required>
          {#snippet children(controlProps)}
            <Select
              {...controlProps}
              bind:value={reason}
              options={reasonOptions}
              placeholder={t['admin.payments.refund.reasonPlaceholder']()}
              disabled={submitting || !hasPermission}
              required
            />
          {/snippet}
        </Field>

        <Field label={t['admin.payments.refund.noteLabel']()}>
          {#snippet children(controlProps)}
            <Input
              {...controlProps}
              bind:value={note}
              placeholder={t['admin.payments.refund.notePlaceholder']()}
              disabled={submitting || !hasPermission}
            />
          {/snippet}
        </Field>
      </Stack>
    {/snippet}

    {#snippet footer()}
      <Button variant="ghost" onclick={handleClose} disabled={submitting}>
        {t['admin.payments.refund.cancelButton']()}
      </Button>
      <Button
        variant="danger"
        disabled={!isValid || submitting}
        loading={submitting}
        loadingLabel={t['admin.payments.refund.submitting']()}
        onclick={handleSubmit}
      >
        {t['admin.payments.refund.confirmButton']()}
      </Button>
    {/snippet}
  </Dialog>
{/if}

<style>
  .sanvi-refund-dialog__summary {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
    padding: var(--sanvi-spacing-3);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-background-secondary);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-refund-dialog__summary-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-refund-dialog__summary-row--highlight {
    color: var(--sanvi-color-text-primary);
    font-weight: var(--sanvi-font-weight-semibold);
    padding-block: var(--sanvi-spacing-1);
    border-block: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
  }

  .sanvi-refund-dialog__amount-strong {
    color: var(--sanvi-color-solid-error-base);
    font-size: var(--sanvi-font-size-md);
  }

  .sanvi-refund-dialog__radio-label {
    display: inline-flex;
    align-items: center;
    gap: var(--sanvi-spacing-2);
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-primary);
    cursor: pointer;
  }

  .sanvi-refund-dialog__number-input {
    width: 100%;
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-3);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-background-primary);
    color: var(--sanvi-color-text-primary);
    font-size: var(--sanvi-font-size-md);
  }

  .sanvi-refund-dialog__number-input:disabled {
    background: var(--sanvi-color-background-disabled);
    color: var(--sanvi-color-text-disabled);
    cursor: not-allowed;
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
