<script lang="ts">
import { ApiError, extendDsr, listTenantDsrs, rejectDsr, submitTenantDsr } from '@sanvi/api-client'
import type { components } from '@sanvi/api-client'
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

const COPY = {
  pageTitle: 'Privacy & Data Requests',
  pageDescription:
    'Handle your end users\u2019 privacy requests, submit on their behalf, and review your obligations.',
  tabRequests: 'Requests',
  tabSubmit: 'Submit on behalf',
  tabGuidance: 'Guidance',
  loading: 'Loading privacy requests',
  genericError: 'Could not load data subject requests. Please try again in a moment.',
  forbiddenError: "You don't have permission to view this tenant's privacy requests.",
  requestsTitle: 'Data subject requests',
  requestsIntro:
    'Requests submitted by or on behalf of your end users, with the response deadline for each jurisdiction.',
  tableCaption: 'Data subject requests ledger',
  receivedCol: 'Received',
  kindCol: 'Kind',
  jurisdictionCol: 'Jurisdiction',
  statusCol: 'Status',
  dueCol: 'Due',
  actionsCol: 'Actions',
  extendAction: 'Extend',
  rejectAction: 'Reject',
  dueBadge: (days: number) => `Due ${days}d`,
  emptyTitle: 'No data subject requests yet.',
  emptyDescription:
    'When your end users ask to access, export, or delete their data, the requests appear here.',
  extendTitle: 'Extend deadline',
  extendIntro:
    'This grants the one deadline extension allowed for the request. The new due date follows the jurisdiction\u2019s rules.',
  extendDue: (date: string) => `Current due date: ${date}.`,
  extendCta: 'Confirm extension',
  extended: 'Deadline extended.',
  rejectTitle: 'Reject request',
  rejectIntro:
    'The reason below is shown to the subject. Subjects in US jurisdictions also receive the authority complaint route with the refusal.',
  reasonLabel: 'Reason',
  reasonPlaceholder: 'e.g. we could not verify the requester\u2019s identity',
  rejectCta: 'Reject request',
  rejected: 'Request rejected.',
  actionError: 'The action failed. Please try again.',
  cancel: 'Cancel',
  submitTitle: 'Submit a request on behalf of an end user',
  submitIntro:
    'File a privacy request for one of your end users when they contact you directly instead of using the storefront privacy centre.',
  kindLabel: 'Request kind',
  emailLabel: 'End-user email',
  emailPlaceholder: 'customer@example.com',
  noteLabel: 'Note (optional)',
  notePlaceholder: 'Context for the reviewer, e.g. the order the request concerns.',
  submitCta: 'Submit request',
  submitError: 'Could not submit the request. Please try again.',
  submitSuccessTitle: 'Request submitted.',
  submitSuccess: (jurisdiction: string, due: string) =>
    `Jurisdiction ${jurisdiction}. Response due by ${due}.`,
  guidanceTitle: 'Your processor role',
  guidanceBody:
    'Your end users\u2019 personal data stays under your control. Sanvi processes it on your instructions as a processor or service provider \u2014 it never sells or shares it, and it answers your end users\u2019 requests only through you or through the storefront privacy centre acting on your behalf.',
  guidanceDetail:
    'As the controller (or business) for your end users\u2019 data, you are responsible for answering their requests within the deadline of the jurisdiction that applies. Use this console to track those deadlines, extend once where the law allows, and record refusals with a reason. Requests submitted here are filed with requester type "tenant operator" so the audit trail distinguishes them from requests your end users filed themselves.',
}

const KIND_LABELS: Partial<Record<DsrKind, string>> = {
  access: 'Access',
  export: 'Export',
  erasure: 'Erasure',
  rectification: 'Rectification',
  opt_out_sale_or_share: 'Opt out of sale or share',
  opt_out_targeted_advertising: 'Opt out of targeted advertising',
  limit_sensitive_use: 'Limit sensitive use',
}

// The kinds a tenant operator can file on behalf of an end user (the
// subject-facing self-service adds the remaining kinds itself).
const SUBMITTABLE_KINDS: DsrKind[] = [
  'access',
  'export',
  'erasure',
  'rectification',
  'opt_out_sale_or_share',
  'opt_out_targeted_advertising',
  'limit_sensitive_use',
]

const KIND_OPTIONS: SelectOption[] = SUBMITTABLE_KINDS.map((kind) => ({
  value: kind,
  label: KIND_LABELS[kind] ?? kind,
}))

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
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
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
    error = err instanceof ApiError && err.status === 403 ? COPY.forbiddenError : COPY.genericError
  } finally {
    if (seq === loadSeq) loading = false
  }
}

$effect(() => {
  // Reading the active tenant makes the effect re-run (and refetch) on switch.
  void getActiveTenantId()
  void load()
})

const TABS: DetailShellTab[] = [
  { href: 'requests', label: COPY.tabRequests },
  { href: 'submit', label: COPY.tabSubmit },
  { href: 'guidance', label: COPY.tabGuidance },
]

function handleTabNavigate(event: MouseEvent, href: string): void {
  event.preventDefault()
  activeTab = href as typeof activeTab
}

let formKind = $state<string>('access')
let formEmail = $state('')
let formNote = $state('')
let submitting = $state(false)
let submitResult = $state<SubmitResult | undefined>(undefined)
let submitError = $state<string | undefined>(undefined)

async function handleSubmit(): Promise<void> {
  const email = formEmail.trim()
  if (!email) return
  submitting = true
  submitError = undefined
  try {
    const result = await submitTenantDsr(apiClient, {
      kind: formKind as DsrKind,
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
    submitError = err instanceof ApiError && err.detail ? err.detail : COPY.submitError
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
    showToast({ variant: 'success', title: COPY.extended })
    await load()
  } catch (err) {
    showToast({
      variant: 'error',
      title: COPY.actionError,
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
    showToast({ variant: 'success', title: COPY.rejected })
    await load()
  } catch (err) {
    showToast({
      variant: 'error',
      title: COPY.actionError,
      description: err instanceof ApiError && err.detail ? err.detail : undefined,
    })
  } finally {
    rejecting = false
  }
}
</script>

<svelte:head>
  <title>{COPY.pageTitle}</title>
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
      <Badge variant="warning">{COPY.dueBadge(daysOverdue(row.due_at))}</Badge>
    {/if}
  </Cluster>
{/snippet}

{#snippet actionsCell(row: DsrRow)}
  <Cluster gap="2">
    <Button variant="secondary" size="sm" onclick={() => openExtend(row)}>
      {COPY.extendAction}
    </Button>
    <Button variant="secondary" size="sm" onclick={() => openReject(row)}>
      {COPY.rejectAction}
    </Button>
  </Cluster>
{/snippet}

<DetailShell
  title={COPY.pageTitle}
  subtitle={COPY.pageDescription}
  tabs={TABS}
  activeHref={activeTab}
  onNavigate={handleTabNavigate}
>
  {#if loading}
    <Spinner label={COPY.loading} />
  {:else if error}
    <Alert variant="error">{error}</Alert>
  {:else if activeTab === 'requests'}
    <Stack gap="4">
      <div>
        <h2>{COPY.requestsTitle}</h2>
        <p class="sanvi-privacy__muted">{COPY.requestsIntro}</p>
      </div>

      {#if requests.length === 0}
        <EmptyState title={COPY.emptyTitle} description={COPY.emptyDescription} />
      {:else}
        <Table
          caption={COPY.tableCaption}
          rows={requests}
          getRowId={(row) => row.request_id}
          columns={[
            { key: 'received_at', header: COPY.receivedCol, cell: receivedCell },
            { key: 'kind', header: COPY.kindCol },
            { key: 'jurisdiction', header: COPY.jurisdictionCol },
            { key: 'status', header: COPY.statusCol, cell: statusCell },
            { key: 'due_at', header: COPY.dueCol, cell: dueCell },
            { key: 'actions', header: COPY.actionsCol, cell: actionsCell },
          ]}
        />
      {/if}
    </Stack>

  {:else if activeTab === 'submit'}
    <Stack gap="4">
      <div>
        <h2>{COPY.submitTitle}</h2>
        <p class="sanvi-privacy__muted">{COPY.submitIntro}</p>
      </div>

      {#if submitResult}
        <Alert variant="success" title={COPY.submitSuccessTitle}>
          {COPY.submitSuccess(submitResult.jurisdiction, formatDate(submitResult.due_at))}
        </Alert>
      {/if}
      {#if submitError}
        <Alert variant="error">{submitError}</Alert>
      {/if}

      <Stack gap="4">
        <Field label={COPY.kindLabel} required>
          {#snippet children({ id })}
            <Select {id} bind:value={formKind} options={KIND_OPTIONS} required />
          {/snippet}
        </Field>
        <Field label={COPY.emailLabel} required>
          {#snippet children({ id })}
            <Input
              {id}
              type="email"
              bind:value={formEmail}
              placeholder={COPY.emailPlaceholder}
              required
            />
          {/snippet}
        </Field>
        <Field label={COPY.noteLabel}>
          {#snippet children({ id })}
            <Textarea {id} bind:value={formNote} rows={3} placeholder={COPY.notePlaceholder} />
          {/snippet}
        </Field>
        <div>
          <Button loading={submitting} disabled={!formEmail.trim()} onclick={handleSubmit}>
            {COPY.submitCta}
          </Button>
        </div>
      </Stack>
    </Stack>

  {:else if activeTab === 'guidance'}
    <Stack gap="4">
      <Alert variant="info" title={COPY.guidanceTitle}>
        {COPY.guidanceBody}
      </Alert>
      <p>{COPY.guidanceDetail}</p>
    </Stack>
  {/if}
</DetailShell>

{#if extendTarget}
  {@const target = extendTarget}
  <Dialog bind:open={extendOpen} titleText={COPY.extendTitle}>
    {#snippet children()}
      <Stack gap="3">
        <p>{COPY.extendIntro}</p>
        <p>{COPY.extendDue(formatDate(target.due_at))}</p>
      </Stack>
    {/snippet}
    {#snippet footer()}
      <Button variant="ghost" onclick={() => (extendOpen = false)}>{COPY.cancel}</Button>
      <Button loading={extending} onclick={handleExtend}>{COPY.extendCta}</Button>
    {/snippet}
  </Dialog>
{/if}

{#if rejectTarget}
  <Dialog bind:open={rejectOpen} titleText={COPY.rejectTitle}>
    {#snippet children()}
      <Stack gap="3">
        <p>{COPY.rejectIntro}</p>
        <Field label={COPY.reasonLabel} required>
          {#snippet children({ id })}
            <Textarea
              {id}
              bind:value={rejectReason}
              rows={4}
              placeholder={COPY.reasonPlaceholder}
              required
            />
          {/snippet}
        </Field>
      </Stack>
    {/snippet}
    {#snippet footer()}
      <Button variant="ghost" onclick={() => (rejectOpen = false)}>{COPY.cancel}</Button>
      <Button
        variant="danger"
        disabled={!rejectReason.trim()}
        loading={rejecting}
        onclick={handleReject}
      >
        {COPY.rejectCta}
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
