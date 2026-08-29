<script lang="ts">
import { approveRequest, listPendingApprovals, rejectRequest } from '@sanvi/api-client'
import type { components } from '@sanvi/api-client'
import { t } from '@sanvi/i18n'
import {
  ApprovalRequest,
  type ApprovalRequestItem,
  EmptyState,
  Spinner,
  Stack,
  showToast,
} from '@sanvi/ui'
import { apiClient } from '../lib/api'

type ApprovalRow = components['schemas']['ApprovalView']

let approvals = $state<ApprovalRow[]>([])
let loading = $state(true)
let error = $state<string | undefined>(undefined)
let submittingId = $state<string | undefined>(undefined)

async function load(): Promise<void> {
  loading = true
  error = undefined
  try {
    approvals = (await listPendingApprovals(apiClient)).filter(
      (approval) => approval.status === 'pending',
    )
  } catch {
    error = t['platform.approvals.errorMessage']()
  } finally {
    loading = false
  }
}

$effect(() => {
  void load()
})

function detailFor(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined
  const record = payload as Record<string, unknown>
  const parts = ['feature_key', 'tenant_id', 'plan_key', 'reason']
    .map((key) => (typeof record[key] === 'string' ? `${key}: ${record[key]}` : undefined))
    .filter((part): part is string => Boolean(part))
  if (parts.length > 0) return parts.join(' · ')
  try {
    const json = JSON.stringify(payload)
    return json === '{}' ? undefined : json
  } catch {
    return undefined
  }
}

function toItem(approval: ApprovalRow): ApprovalRequestItem {
  return {
    id: approval.id,
    actionLabel: approval.action_type,
    requestedByLabel: approval.requested_by,
    requestedAt: approval.requested_at,
    detail: detailFor(approval.payload),
  }
}

async function handleApprove(id: string): Promise<void> {
  submittingId = id
  try {
    await approveRequest(apiClient, id)
    approvals = approvals.filter((approval) => approval.id !== id)
    showToast({ variant: 'success', title: t['platform.approvals.approved']() })
  } catch {
    showToast({ variant: 'error', title: t['platform.approvals.approveError']() })
  } finally {
    submittingId = undefined
  }
}

async function handleReject(id: string): Promise<void> {
  submittingId = id
  try {
    await rejectRequest(apiClient, id)
    approvals = approvals.filter((approval) => approval.id !== id)
    showToast({ variant: 'success', title: t['platform.approvals.rejected']() })
  } catch {
    showToast({ variant: 'error', title: t['platform.approvals.rejectError']() })
  } finally {
    submittingId = undefined
  }
}
</script>

<Stack gap="6">
  <div>
    <h1>{t['platform.approvals.title']()}</h1>
    <p>{t['platform.approvals.description']()}</p>
  </div>

  {#if loading}
    <Spinner label={t['common.loading']()} />
  {:else if error}
    <EmptyState title={error} />
  {:else if approvals.length === 0}
    <EmptyState title={t['platform.approvals.empty']()} />
  {:else}
    <Stack gap="3">
      {#each approvals as approval (approval.id)}
        <ApprovalRequest
          request={toItem(approval)}
          submitting={submittingId === approval.id}
          onApprove={() => handleApprove(approval.id)}
          onReject={() => handleReject(approval.id)}
        />
      {/each}
    </Stack>
  {/if}
</Stack>
