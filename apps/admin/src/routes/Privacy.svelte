<script lang="ts">
import { ApiError, extendDsr, listTenantDsrs, rejectDsr, submitTenantDsr } from '@sanvi/api-client'
import type { components } from '@sanvi/api-client'
import { fmt, normalizeEmail, t } from '@sanvi/i18n'
import { getActiveTenantId } from '@sanvi/tenant'
import {
  Alert,
  Badge,
  Button,
  Cluster,
  DetailShell,
  Dialog,
  EmptyState,
  Field,
  Input,
  Select,
  showToast,
  Spinner,
  Stack,
  Table,
  Textarea,
} from '@sanvi/ui'
import type { DetailShellTab, SelectOption } from '@sanvi/ui'
import { apiClient } from '../lib/api'

type DsrRow = components['schemas']['RequestOperatorView']
type DsrKind = components['schemas']['DsrKind']
type DsrStatusValue = components['schemas']['DsrStatus']
type SubmitResult = components['schemas']['SubmitDsrOutput']

// The kinds a tenant operator can file on behalf of an end user (the
// subject-facing self-service adds the remaining kinds itself).
const SUBMITTABLE_KINDS = [
  'access',
  'export',
  'erasure',
  'rectification',
  'opt_out_sale_or_share',
  'opt_out_targeted_advertising',
  'limit_sensitive_use',
] as const

type SubmittableKind = (typeof SUBMITTABLE_KINDS)[number]

const STATUS_VARIANT: Record<DsrStatusValue, 'neutral' | 'info' | 'success' | 'warning' | 'error'> =
  {
    awaiting_verification: 'info',
    in_progress: 'info',
    partially_complete: 'warning',
    completed: 'success',
    rejected: 'error',
    on_hold: 'neutral',
    under_appeal: 'warning',
  }

const DAY_MS = 86_400_000

function isOpen(status: DsrStatusValue): boolean {
  return status !== 'completed' && status !== 'rejected'
}

function isOverdue(dueAt: string): boolean {
  return new Date(dueAt).getTime() < Date.now()
}

function daysOverdue(dueAt: string): number {
  return Math.ceil((Date.now() - new Date(dueAt).getTime()) / DAY_MS)
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '\u2014'
  return fmt.date(dateStr, 'medium')
}

let activeTab = $state<'requests' | 'submit' | 'guidance'>('requests')
let requests = $state<DsrRow[]>([])
let loading = $state(true)
let error = $state<string | undefined>(undefined)

// Sequencing token — a tenant switch re-runs the load effect, and a slow
// response for the previous tenant must never overwrite the new tenant's requests.
let loadSeq = 0

async function load(): Promise<void> {
  const seq = ++loadSeq
  loading = true
  error = undefined
  try {
    const result = await listTenantDsrs(apiClient)
    if (seq !== loadSeq) return
    requests = result ?? []
  } catch (err) {
    if (seq !== loadSeq) return
    // A 403 means this session's role can't see the request ledger —
    // a different message from a transport or validation failure.
    error =
      err instanceof ApiError && err.status === 403
        ? t['admin.privacy.forbiddenError']()
        : t['admin.privacy.genericError']()
  } finally {
    if (seq === loadSeq) loading = false
  }
}

$effect(() => {
  // Reading the active tenant makes the effect re-run (and refetch) on switch.
  void getActiveTenantId()
  void load()
})

// Request-kind Select options derive from the catalog so labels re-render on
// a locale switch.
const KIND_LABEL_KEYS = {
  access: 'admin.privacy.kindAccess',
  export: 'admin.privacy.kindExport',
  erasure: 'admin.privacy.kindErasure',
  rectification: 'admin.privacy.kindRectification',
  opt_out_sale_or_share: 'admin.privacy.kindOptOutSaleOrShare',
  opt_out_targeted_advertising: 'admin.privacy.kindOptOutTargetedAdvertising',
  limit_sensitive_use: 'admin.privacy.kindLimitSensitiveUse',
} as const

const KIND_OPTIONS: SelectOption[] = $derived(
  SUBMITTABLE_KINDS.map((kind) => ({ value: kind, label: t[KIND_LABEL_KEYS[kind]]() })),
)

const TABS: DetailShellTab[] = $derived([
  { href: 'requests', label: t['admin.privacy.tabRequests']() },
  { href: 'submit', label: t['admin.privacy.tabSubmit']() },
  { href: 'guidance', label: t['admin.privacy.tabGuidance']() },
])

function handleTabNavigate(event: MouseEvent, href: string): void {
  event.preventDefault()
  activeTab = href as typeof activeTab
}

let formKind = $state<SubmittableKind>('access')
let formEmail = $state('')
let formNote = $state('')
let submitting = $state(false)
let submitResult = $state<SubmitResult | undefined>(undefined)
let submitError = $state<string | undefined>(undefined)

async function handleSubmit(): Promise<void> {
  // NFKC-normalize what we submit (full-width ＠ etc.); the input keeps the
  // raw text for display.
  const email = normalizeEmail(formEmail)
  if (!email) return
  submitting = true
  submitError = undefined
  try {
    const result = await submitTenantDsr(apiClient, {
      kind: formKind,
      requester: 'tenant_operator',
      subject: {
        kind: 'end_user',
        email,
        evidence: [],
      },
      note: formNote.trim() || undefined,
    })
    submitResult = result
    formEmail = ''
    formNote = ''
  } catch (err) {
    submitError =
      err instanceof ApiError && err.detail ? err.detail : t['admin.privacy.submitError']()
  } finally {
    submitting = false
  }
}

let extendTarget = $state<DsrRow | undefined>(undefined)
let extendOpen = $state(false)
let extending = $state(false)

function openExtend(row: DsrRow): void {
  extendTarget = row
  extendOpen = true
}

async function handleExtend(): Promise<void> {
  if (!extendTarget) return
  extending = true
  try {
    await extendDsr(apiClient, extendTarget.request_id)
    extendOpen = false
    extendTarget = undefined
    showToast({ variant: 'success', title: t['admin.privacy.extended']() })
    await load()
  } catch (err) {
    showToast({
      variant: 'error',
      title: t['admin.privacy.actionError'](),
      description: err instanceof ApiError && err.detail ? err.detail : undefined,
    })
  } finally {
    extending = false
  }
}

let rejectTarget = $state<DsrRow | undefined>(undefined)
let rejectOpen = $state(false)
let rejectReason = $state('')
let rejecting = $state(false)

function openReject(row: DsrRow): void {
  rejectTarget = row
  rejectReason = ''
  rejectOpen = true
}

async function handleReject(): Promise<void> {
  if (!rejectTarget) return
  const reason = rejectReason.trim()
  if (!reason) return
  rejecting = true
  try {
    await rejectDsr(apiClient, rejectTarget.request_id, { reason })
    rejectOpen = false
    rejectTarget = undefined
    showToast({ variant: 'success', title: t['admin.privacy.rejected']() })
    await load()
  } catch (err) {
    showToast({
      variant: 'error',
      title: t['admin.privacy.actionError'](),
      description: err instanceof ApiError && err.detail ? err.detail : undefined,
    })
  } finally {
    rejecting = false
  }
}
</script>

<svelte:head>
  <title>{t['admin.privacy.pageTitle']()}</title>
</svelte:head>

{#snippet receivedCell(row: DsrRow)}
  <span>{formatDate(row.received_at)}</span>
{/snippet}

{#snippet statusCell(row: DsrRow)}
  <Badge variant={STATUS_VARIANT[row.status]}>{row.status}</Badge>
{/snippet}

{#snippet dueCell(row: DsrRow)}
  <Cluster gap="2">
    <span>{formatDate(row.due_at)}</span>
    {#if isOpen(row.status) && isOverdue(row.due_at)}
      <Badge variant="warning">{t['admin.privacy.dueBadge']({ days: daysOverdue(row.due_at) })}</Badge>
    {/if}
  </Cluster>
{/snippet}

{#snippet actionsCell(row: DsrRow)}
  <Cluster gap="2">
    <Button variant="secondary" size="sm" onclick={() => openExtend(row)}>
      {t['admin.privacy.extendAction']()}
    </Button>
    <Button variant="secondary" size="sm" onclick={() => openReject(row)}>
      {t['admin.privacy.rejectAction']()}
    </Button>
  </Cluster>
{/snippet}

<DetailShell
  title={t['admin.privacy.pageTitle']()}
  subtitle={t['admin.privacy.pageDescription']()}
  tabs={TABS}
  activeHref={activeTab}
  onNavigate={handleTabNavigate}
>
  {#if loading}
    <Spinner label={t['admin.privacy.loading']()} />
  {:else if error}
    <Alert variant="error">{error}</Alert>
  {:else if activeTab === 'requests'}
    <Stack gap="4">
      <div>
        <h2>{t['admin.privacy.requestsTitle']()}</h2>
        <p class="sanvi-privacy__muted">{t['admin.privacy.requestsIntro']()}</p>
      </div>

      {#if requests.length === 0}
        <EmptyState title={t['admin.privacy.emptyTitle']()} description={t['admin.privacy.emptyDescription']()} />
      {:else}
        <Table
          caption={t['admin.privacy.tableCaption']()}
          rows={requests}
          getRowId={(row) => row.request_id}
          columns={[
            { key: 'received_at', header: t['admin.privacy.receivedCol'](), cell: receivedCell },
            { key: 'kind', header: t['admin.privacy.kindCol']() },
            { key: 'jurisdiction', header: t['admin.privacy.jurisdictionCol']() },
            { key: 'status', header: t['admin.privacy.statusCol'](), cell: statusCell },
            { key: 'due_at', header: t['admin.privacy.dueCol'](), cell: dueCell },
            { key: 'actions', header: t['admin.privacy.actionsCol'](), cell: actionsCell },
          ]}
        />
      {/if}
    </Stack>

  {:else if activeTab === 'submit'}
    <Stack gap="4">
      <div>
        <h2>{t['admin.privacy.submitTitle']()}</h2>
        <p class="sanvi-privacy__muted">{t['admin.privacy.submitIntro']()}</p>
      </div>

      {#if submitResult}
        <Alert variant="success" title={t['admin.privacy.submitSuccessTitle']()}>
          {t['admin.privacy.submitSuccess']({
            jurisdiction: submitResult.jurisdiction,
            due: formatDate(submitResult.due_at),
          })}
        </Alert>
      {/if}
      {#if submitError}
        <Alert variant="error">{submitError}</Alert>
      {/if}

      <Stack gap="4">
        <Field label={t['admin.privacy.kindLabel']()} required>
          {#snippet children({ id })}
            <Select {id} bind:value={formKind} options={KIND_OPTIONS} required />
          {/snippet}
        </Field>
        <Field label={t['admin.privacy.emailLabel']()} required>
          {#snippet children({ id })}
            <Input
              {id}
              type="email"
              bind:value={formEmail}
              placeholder={t['admin.privacy.emailPlaceholder']()}
              required
            />
          {/snippet}
        </Field>
        <Field label={t['admin.privacy.noteLabel']()}>
          {#snippet children({ id })}
            <Textarea {id} bind:value={formNote} rows={3} placeholder={t['admin.privacy.notePlaceholder']()} />
          {/snippet}
        </Field>
        <div>
          <Button loading={submitting} disabled={!formEmail.trim()} onclick={handleSubmit}>
            {t['admin.privacy.submitCta']()}
          </Button>
        </div>
      </Stack>
    </Stack>

  {:else if activeTab === 'guidance'}
    <Stack gap="4">
      <Alert variant="info" title={t['admin.privacy.guidanceTitle']()}>
        {t['admin.privacy.guidanceBody']()}
      </Alert>
      <p>{t['admin.privacy.guidanceDetail']()}</p>
    </Stack>
  {/if}
</DetailShell>

{#if extendTarget}
  {@const target = extendTarget}
  <Dialog bind:open={extendOpen} titleText={t['admin.privacy.extendTitle']()}>
    {#snippet children()}
      <Stack gap="3">
        <p>{t['admin.privacy.extendIntro']()}</p>
        <p>{t['admin.privacy.extendDue']({ date: formatDate(target.due_at) })}</p>
      </Stack>
    {/snippet}
    {#snippet footer()}
      <Button variant="ghost" onclick={() => (extendOpen = false)}>{t['admin.privacy.cancel']()}</Button>
      <Button loading={extending} onclick={handleExtend}>{t['admin.privacy.extendCta']()}</Button>
    {/snippet}
  </Dialog>
{/if}

{#if rejectTarget}
  <Dialog bind:open={rejectOpen} titleText={t['admin.privacy.rejectTitle']()}>
    {#snippet children()}
      <Stack gap="3">
        <p>{t['admin.privacy.rejectIntro']()}</p>
        <Field label={t['admin.privacy.reasonLabel']()} required>
          {#snippet children({ id })}
            <Textarea
              {id}
              bind:value={rejectReason}
              rows={4}
              placeholder={t['admin.privacy.reasonPlaceholder']()}
              required
            />
          {/snippet}
        </Field>
      </Stack>
    {/snippet}
    {#snippet footer()}
      <Button variant="ghost" onclick={() => (rejectOpen = false)}>{t['admin.privacy.cancel']()}</Button>
      <Button
        variant="danger"
        disabled={!rejectReason.trim()}
        loading={rejecting}
        onclick={handleReject}
      >
        {t['admin.privacy.rejectCta']()}
      </Button>
    {/snippet}
  </Dialog>
{/if}

<style>
  .sanvi-privacy__muted {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }
</style>
