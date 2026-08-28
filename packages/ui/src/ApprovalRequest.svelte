<script lang="ts">
import Button from './Button.svelte'
import Stack from './layout/Stack.svelte'

export interface ApprovalRequestItem {
  id: string
  actionLabel: string
  requestedByLabel: string
  requestedAt: string
  /** Best-effort context extracted from the request's payload (e.g. the original grant's reason) — the approve/reject endpoints themselves take no body, so this is display-only, never resent. */
  detail?: string
  targetLabel?: string
}

interface Props {
  request: ApprovalRequestItem
  approveLabel?: string
  rejectLabel?: string
  confirmRejectLabel?: string
  cancelLabel?: string
  submitting?: boolean
  onApprove: () => void | Promise<void>
  onReject: () => void | Promise<void>
}

let {
  request,
  approveLabel = 'Approve',
  rejectLabel = 'Reject',
  confirmRejectLabel = 'Confirm reject',
  cancelLabel = 'Cancel',
  submitting = false,
  onApprove,
  onReject,
}: Props = $props()

// Reject takes no reason — the backend endpoint accepts no body — so this
// is a lightweight two-click confirm, not a form.
let confirmingReject = $state(false)

/** Human-readable wall-clock time; the ISO string stays on the `datetime` attribute. */
function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    date,
  )
}

async function confirmReject(): Promise<void> {
  await onReject()
  confirmingReject = false
}
</script>

<article class="sanvi-approval-request">
  <Stack gap="2">
    <div class="sanvi-approval-request__header">
      <span class="sanvi-approval-request__action">{request.actionLabel}</span>
      {#if request.targetLabel}
        <span class="sanvi-approval-request__target">{request.targetLabel}</span>
      {/if}
    </div>
    <p class="sanvi-approval-request__meta">
      {request.requestedByLabel} · <time datetime={request.requestedAt}>{formatTimestamp(request.requestedAt)}</time>
    </p>
    {#if request.detail}
      <p class="sanvi-approval-request__reason">{request.detail}</p>
    {/if}

    <span class="sanvi-approval-request__actions">
      {#if confirmingReject}
        <Button variant="ghost" size="sm" onclick={() => (confirmingReject = false)}>{cancelLabel}</Button>
        <Button variant="danger" size="sm" loading={submitting} onclick={confirmReject}>
          {confirmRejectLabel}
        </Button>
      {:else}
        <Button variant="ghost" size="sm" onclick={() => (confirmingReject = true)}>{rejectLabel}</Button>
        <Button variant="primary" size="sm" loading={submitting} onclick={onApprove}>{approveLabel}</Button>
      {/if}
    </span>
  </Stack>
</article>

<style>
  .sanvi-approval-request {
    padding: var(--sanvi-spacing-4);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-md);
  }

  .sanvi-approval-request__header {
    display: flex;
    align-items: center;
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-approval-request__action {
    font-weight: var(--sanvi-font-weight-semibold);
  }

  .sanvi-approval-request__target {
    color: var(--sanvi-color-text-secondary);
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-approval-request__meta {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-approval-request__reason {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-approval-request__actions {
    display: flex;
    gap: var(--sanvi-spacing-2);
    justify-content: flex-end;
  }
</style>
