<script lang="ts">
import {
  ApiError,
  decideAppeal,
  extendDsr,
  listAppeals,
  listDsrs,
  listIncidents,
  listJurisdictions,
  listObligations,
  listRetentionRules,
  listSubprocessors,
  markObligationNotified,
  recordIncident,
  rejectDsr,
  removeSubprocessor,
  upsertRetentionRule,
  upsertSubprocessor,
} from '@sanvi/api-client'
import type { components } from '@sanvi/api-client'
import { fmt, t } from '@sanvi/i18n'
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Cluster,
  DetailShell,
  type DetailShellTab,
  Dialog,
  Field,
  Input,
  Radio,
  Select,
  showToast,
  Spinner,
  Stack,
  Table,
  Textarea,
} from '@sanvi/ui'
import { apiClient } from '../lib/api'

type DsrRow = components['schemas']['RequestOperatorView']
type AppealRow = components['schemas']['Appeal']
type JurisdictionRow = components['schemas']['JurisdictionProfile']
type IncidentRow = components['schemas']['BreachIncident']
type ObligationRow = components['schemas']['NotificationObligation']
type RetentionRow = components['schemas']['RetentionRule']
type SubProcessorRow = components['schemas']['SubProcessor']
type DataClass = components['schemas']['DataClass']
type RetentionAction = 'delete' | 'anonymise' | 'archive'
type AppealOutcome = components['schemas']['AppealOutcome']

// Symbols, not copy — an em-dash placeholder and a join separator carry no
// words, so they stay local constants rather than catalog entries.
const NONE = '—'
const DATA_CLASS_SEPARATOR = ', '

// `$derived` — the labels go through `t` and must survive a locale switch.
const TABS = $derived<DetailShellTab[]>([
  { href: 'requests', label: t['platform.privacy.tabRequests']() },
  { href: 'appeals', label: t['platform.privacy.tabAppeals']() },
  { href: 'jurisdictions', label: t['platform.privacy.tabJurisdictions']() },
  { href: 'incidents', label: t['platform.privacy.tabIncidents']() },
  { href: 'retention', label: t['platform.privacy.tabRetention']() },
  { href: 'subprocessors', label: t['platform.privacy.tabSubprocessors']() },
])

type ActiveTab =
  | 'requests'
  | 'appeals'
  | 'jurisdictions'
  | 'incidents'
  | 'retention'
  | 'subprocessors'

let activeTab = $state<ActiveTab>('requests')

function handleTabNavigate(event: MouseEvent, href: string): void {
  event.preventDefault()
  activeTab = href as ActiveTab
}

const DSR_STATUS_VARIANT: Record<string, 'neutral' | 'info' | 'success' | 'warning' | 'error'> = {
  awaiting_verification: 'neutral',
  in_progress: 'info',
  partially_complete: 'info',
  completed: 'success',
  rejected: 'error',
  on_hold: 'warning',
  under_appeal: 'warning',
}

// A due date in the past only means "overdue" while the request can still be
// worked; completed/rejected rows keep their historical deadline as a record.
const DSR_TERMINAL_STATUSES = new Set(['completed', 'rejected'])

const DATA_CLASS_OPTIONS = [
  'identity_profile',
  'authentication',
  'membership',
  'contact',
  'billing',
  'invoice',
  'audit_log',
  'consent_record',
  'preference',
  'communication',
  'jurisdiction',
  'request_record',
].map((value) => ({ value, label: value }))

const RETENTION_ACTION_OPTIONS = [
  { value: 'delete', label: 'delete' },
  { value: 'anonymise', label: 'anonymise' },
  { value: 'archive', label: 'archive' },
]

const SUBPROCESSOR_ROLE_OPTIONS = [
  { value: 'processor', label: 'processor' },
  { value: 'service_provider', label: 'service_provider' },
  { value: 'contractor', label: 'contractor' },
  { value: 'third_party', label: 'third_party' },
]

let dsrs = $state<DsrRow[]>([])
let appeals = $state<AppealRow[]>([])
let jurisdictions = $state<JurisdictionRow[]>([])
let incidents = $state<IncidentRow[]>([])
let retentionRules = $state<RetentionRow[]>([])
let subprocessors = $state<SubProcessorRow[]>([])

let loading = $state(true)
let error = $state<string | undefined>(undefined)

let loadSeq = 0

async function load(): Promise<void> {
  const seq = ++loadSeq
  loading = true
  error = undefined
  try {
    const [
      dsrResult,
      appealResult,
      jurisdictionResult,
      incidentResult,
      retentionResult,
      subprocessorResult,
    ] = await Promise.all([
      listDsrs(apiClient),
      listAppeals(apiClient),
      listJurisdictions(apiClient),
      listIncidents(apiClient),
      listRetentionRules(apiClient),
      listSubprocessors(apiClient),
    ])
    if (seq !== loadSeq) return
    dsrs = dsrResult ?? []
    appeals = appealResult ?? []
    jurisdictions = jurisdictionResult ?? []
    incidents = incidentResult ?? []
    retentionRules = retentionResult ?? []
    subprocessors = subprocessorResult ?? []
  } catch {
    if (seq !== loadSeq) return
    error = t['platform.privacy.loadError']()
  } finally {
    if (seq === loadSeq) loading = false
  }
}

$effect(() => {
  void load()
})

function formatDateTime(value?: string | null): string {
  // `fmt.date` binds to the current locale (and passes the raw string back
  // when it can't parse it) — the old `toLocaleDateString(undefined, …)`
  // hardcoded the runtime's locale instead of the chosen one.
  if (!value) return NONE
  return fmt.date(value, 'medium')
}

function isPastDue(dueAt: string): boolean {
  return new Date(dueAt).getTime() < Date.now()
}

function dsrOverdue(row: DsrRow): boolean {
  return !DSR_TERMINAL_STATUSES.has(row.status) && isPastDue(row.due_at)
}

function appealDecided(row: AppealRow): boolean {
  return row.decided_at != null || row.outcome != null
}

function appealOverdue(row: AppealRow): boolean {
  return !appealDecided(row) && isPastDue(row.due_at)
}

function errorDetail(err: unknown): string | undefined {
  if (err instanceof ApiError) return err.detail ?? err.title
  return undefined
}

// ---- Requests tab ----

let extendingId = $state<string | undefined>(undefined)

async function handleExtend(id: string): Promise<void> {
  extendingId = id
  try {
    await extendDsr(apiClient, id)
    showToast({ variant: 'success', title: t['platform.privacy.extendSuccess']() })
    await load()
  } catch (err) {
    showToast({
      variant: 'error',
      title: t['platform.privacy.extendError'](),
      description: errorDetail(err) ?? t['platform.privacy.genericActionError'](),
    })
  } finally {
    extendingId = undefined
  }
}

let rejectOpen = $state(false)
let rejectTarget = $state<DsrRow | undefined>(undefined)
let rejectReason = $state('')
let rejecting = $state(false)

function openReject(row: DsrRow): void {
  rejectTarget = row
  rejectReason = ''
  rejectOpen = true
}

async function handleReject(): Promise<void> {
  if (!rejectTarget) return
  rejecting = true
  try {
    await rejectDsr(apiClient, rejectTarget.request_id, { reason: rejectReason })
    rejectOpen = false
    showToast({ variant: 'success', title: t['platform.privacy.rejectSuccess']() })
    await load()
  } catch (err) {
    showToast({
      variant: 'error',
      title: t['platform.privacy.rejectError'](),
      description: errorDetail(err) ?? t['platform.privacy.genericActionError'](),
    })
  } finally {
    rejecting = false
  }
}

// ---- Appeals tab ----

let decideOpen = $state(false)
let decideTarget = $state<AppealRow | undefined>(undefined)
let decideOutcome = $state<AppealOutcome>('upheld')
let decideReason = $state('')
let decideSubmitting = $state(false)
let decideError = $state<string | undefined>(undefined)

function openDecide(row: AppealRow): void {
  decideTarget = row
  decideOutcome = 'upheld'
  decideReason = ''
  decideError = undefined
  decideOpen = true
}

async function handleDecide(): Promise<void> {
  if (!decideTarget) return
  decideSubmitting = true
  decideError = undefined
  try {
    await decideAppeal(apiClient, decideTarget.id, {
      outcome: decideOutcome,
      reason: decideReason,
    })
    decideOpen = false
    showToast({ variant: 'success', title: t['platform.privacy.decideSuccess']() })
    await load()
  } catch (err) {
    // 409 here means the operator decided the original request — a
    // two-person rule, not a transient fault. Surface the problem detail
    // inline so the operator understands why the action is refused.
    decideError =
      err instanceof ApiError
        ? (err.detail ?? (err.status === 409 ? t['platform.privacy.selfReviewError']() : err.title))
        : t['platform.privacy.decideError']()
  } finally {
    decideSubmitting = false
  }
}

// ---- Incidents tab ----

let incidentOpen = $state(false)
let incidentDiscoveredAt = $state('')
let incidentSubjects = $state(0)
let incidentTenants = $state(0)
let incidentJurisdictions = $state('')
let incidentDataClass = $state('')
let incidentEncrypted = $state(false)
let recordingIncident = $state(false)

function openRecordIncident(): void {
  incidentDiscoveredAt = ''
  incidentSubjects = 0
  incidentTenants = 0
  incidentJurisdictions = ''
  incidentDataClass = ''
  incidentEncrypted = false
  incidentOpen = true
}

const incidentDiscoveredInvalid = $derived(
  incidentDiscoveredAt === '' || Number.isNaN(new Date(incidentDiscoveredAt).getTime()),
)
const incidentJurisdictionsInvalid = $derived(
  incidentJurisdictions
    .split(',')
    .map((code) => code.trim())
    .filter((code) => code !== '').length === 0,
)
const recordIncidentDisabled = $derived(
  incidentDiscoveredInvalid || incidentJurisdictionsInvalid || incidentDataClass === '',
)

async function handleRecordIncident(): Promise<void> {
  recordingIncident = true
  try {
    await recordIncident(apiClient, {
      discovered_at: new Date(incidentDiscoveredAt).toISOString(),
      subjects: incidentSubjects,
      tenants: incidentTenants,
      data_classes: [incidentDataClass as DataClass],
      jurisdictions: incidentJurisdictions
        .split(',')
        .map((code) => code.trim())
        .filter((code) => code !== ''),
      encrypted_at_rest: incidentEncrypted,
    })
    incidentOpen = false
    showToast({ variant: 'success', title: t['platform.privacy.recordIncidentSuccess']() })
    await load()
  } catch (err) {
    showToast({
      variant: 'error',
      title: t['platform.privacy.recordIncidentError'](),
      description: errorDetail(err) ?? t['platform.privacy.genericActionError'](),
    })
  } finally {
    recordingIncident = false
  }
}

let obligationsOpen = $state(false)
let obligationsIncident = $state<IncidentRow | undefined>(undefined)
let obligations = $state<ObligationRow[]>([])
let obligationsLoading = $state(false)
let obligationsError = $state<string | undefined>(undefined)
let notifyingKey = $state<string | undefined>(undefined)

function obligationKey(row: ObligationRow): string {
  return `${row.audience}:${row.jurisdiction}`
}

async function loadObligations(): Promise<void> {
  if (!obligationsIncident) return
  obligationsLoading = true
  obligationsError = undefined
  try {
    obligations = (await listObligations(apiClient, obligationsIncident.id)) ?? []
  } catch {
    obligationsError = t['platform.privacy.obligationsError']()
  } finally {
    obligationsLoading = false
  }
}

async function openObligations(incident: IncidentRow): Promise<void> {
  obligationsIncident = incident
  obligations = []
  obligationsOpen = true
  await loadObligations()
}

async function handleMarkNotified(row: ObligationRow): Promise<void> {
  if (!obligationsIncident) return
  notifyingKey = obligationKey(row)
  try {
    await markObligationNotified(apiClient, obligationsIncident.id, {
      audience: row.audience,
      jurisdiction: row.jurisdiction,
    })
    showToast({ variant: 'success', title: t['platform.privacy.notifiedSuccess']() })
    await loadObligations()
  } catch (err) {
    showToast({
      variant: 'error',
      title: t['platform.privacy.notifiedError'](),
      description: errorDetail(err) ?? t['platform.privacy.genericActionError'](),
    })
  } finally {
    notifyingKey = undefined
  }
}

// ---- Retention tab ----

let retentionOpen = $state(false)
let retentionTarget = $state<RetentionRow | undefined>(undefined)
let retentionPeriodDays = $state(0)
let retentionAction = $state<RetentionAction>('delete')
let retentionDisclosed = $state(false)
let savingRetention = $state(false)

function openRetention(row: RetentionRow): void {
  retentionTarget = row
  retentionPeriodDays = row.period_days
  retentionAction = row.action as RetentionAction
  retentionDisclosed = row.disclosed_in_notice
  retentionOpen = true
}

async function handleSaveRetention(): Promise<void> {
  if (!retentionTarget) return
  savingRetention = true
  try {
    await upsertRetentionRule(apiClient, {
      data_class: retentionTarget.data_class,
      sensitivity: retentionTarget.sensitivity,
      period_days: retentionPeriodDays,
      action: retentionAction,
      basis: retentionTarget.basis ?? null,
      disclosed_in_notice: retentionDisclosed,
    })
    retentionOpen = false
    showToast({ variant: 'success', title: t['platform.privacy.retentionSuccess']() })
    await load()
  } catch (err) {
    showToast({
      variant: 'error',
      title: t['platform.privacy.retentionError'](),
      description: errorDetail(err) ?? t['platform.privacy.genericActionError'](),
    })
  } finally {
    savingRetention = false
  }
}

// ---- Sub-processors tab ----

let subAddOpen = $state(false)
let subName = $state('')
let subRole = $state('')
let subLocation = $state('')
let subPurpose = $state('')
let savingSubprocessor = $state(false)
let removingSubprocessor = $state<string | undefined>(undefined)

function openAddSubprocessor(): void {
  subName = ''
  subRole = ''
  subLocation = ''
  subPurpose = ''
  subAddOpen = true
}

async function handleAddSubprocessor(): Promise<void> {
  savingSubprocessor = true
  try {
    // This is an upsert keyed by name, and the form collects none of the
    // contract fields. Carry the registered row's values through so re-adding
    // a known name cannot blank the transfer mechanism the public
    // sub-processor page renders.
    const existing = subprocessors.find((row) => row.name === subName)
    await upsertSubprocessor(apiClient, {
      name: subName,
      role: subRole,
      location: subLocation,
      purpose: subPurpose,
      contract_terms: existing?.contract_terms ?? null,
      ...(existing?.transfer_mechanism ? { transfer_mechanism: existing.transfer_mechanism } : {}),
      ...(existing?.dpa_url ? { dpa_url: existing.dpa_url } : {}),
    })
    subAddOpen = false
    showToast({ variant: 'success', title: t['platform.privacy.subAddSuccess']() })
    await load()
  } catch (err) {
    showToast({
      variant: 'error',
      title: t['platform.privacy.subAddError'](),
      description: errorDetail(err) ?? t['platform.privacy.genericActionError'](),
    })
  } finally {
    savingSubprocessor = false
  }
}

async function handleRemoveSubprocessor(name: string): Promise<void> {
  // No confirm dialog: the registry is reversible (re-adding the row restores it).
  removingSubprocessor = name
  try {
    await removeSubprocessor(apiClient, name)
    showToast({ variant: 'success', title: t['platform.privacy.subRemoveSuccess']() })
    await load()
  } catch (err) {
    showToast({
      variant: 'error',
      title: t['platform.privacy.subRemoveError'](),
      description: errorDetail(err) ?? t['platform.privacy.genericActionError'](),
    })
  } finally {
    removingSubprocessor = undefined
  }
}
</script>

{#snippet statusCell(row: DsrRow)}
  <Badge variant={DSR_STATUS_VARIANT[row.status] ?? 'neutral'}>{row.status}</Badge>
{/snippet}

{#snippet dueCell(dueAt: string, overdue: boolean)}
  <Cluster gap="2" align="center">
    <span>{formatDateTime(dueAt)}</span>
    {#if overdue}
      <Badge variant="warning">{t['platform.privacy.overdue']()}</Badge>
    {/if}
  </Cluster>
{/snippet}

{#snippet dsrDueCell(row: DsrRow)}
  {@render dueCell(row.due_at, dsrOverdue(row))}
{/snippet}

{#snippet dsrActionsCell(row: DsrRow)}
  <Cluster gap="2">
    <Button
      size="sm"
      variant="secondary"
      loading={extendingId === row.request_id}
      onclick={() => handleExtend(row.request_id)}
    >
      {t['platform.privacy.extendAction']()}
    </Button>
    <Button size="sm" variant="secondary" onclick={() => openReject(row)}>
      {t['platform.privacy.rejectAction']()}
    </Button>
  </Cluster>
{/snippet}

{#snippet optOutCell(row: JurisdictionRow)}
  {row.honours_universal_opt_out ? t['platform.privacy.yes']() : t['platform.privacy.no']()}
{/snippet}

{#snippet authorityCell(row: JurisdictionRow)}
  {row.authority.name}
{/snippet}

{#snippet subjectsCell(row: IncidentRow)}
  {row.affected.subjects}
{/snippet}

{#snippet tenantsCell(row: IncidentRow)}
  {row.affected.tenants}
{/snippet}

{#snippet dataClassesCell(row: IncidentRow)}
  {row.data_classes.join(DATA_CLASS_SEPARATOR)}
{/snippet}

{#snippet encryptedCell(row: IncidentRow)}
  {row.encrypted_at_rest ? t['platform.privacy.yes']() : t['platform.privacy.no']()}
{/snippet}

{#snippet basisCell(row: RetentionRow)}
  {row.basis ?? NONE}
{/snippet}

{#snippet disclosedCell(row: RetentionRow)}
  {row.disclosed_in_notice ? t['platform.privacy.yes']() : t['platform.privacy.no']()}
{/snippet}

{#snippet transferCell(row: SubProcessorRow)}
  {row.transfer_mechanism ?? NONE}
{/snippet}

{#snippet removedCell(row: SubProcessorRow)}
  {row.removed_at ? formatDateTime(row.removed_at) : NONE}
{/snippet}

{#snippet obligationDueCell(row: ObligationRow)}
  {@render dueCell(row.due_at, !row.notified_at && isPastDue(row.due_at))}
{/snippet}

{#snippet notifiedCell(row: ObligationRow)}
  {row.notified_at ? formatDateTime(row.notified_at) : NONE}
{/snippet}

{#snippet suppressedCell(row: ObligationRow)}
  {row.suppressed_by_encryption ? t['platform.privacy.yes']() : t['platform.privacy.no']()}
{/snippet}

{#snippet obligationActionsCell(row: ObligationRow)}
  {#if !row.notified_at}
    <Button
      size="sm"
      variant="secondary"
      loading={notifyingKey === obligationKey(row)}
      onclick={() => handleMarkNotified(row)}
    >
      {t['platform.privacy.markNotifiedAction']()}
    </Button>
  {/if}
{/snippet}

{#snippet appealDueCell(row: AppealRow)}
  {@render dueCell(row.due_at, appealOverdue(row))}
{/snippet}

{#snippet appealDecisionCell(row: AppealRow)}
  {#if appealDecided(row)}
    <Cluster gap="2" align="center">
      <span>{formatDateTime(row.decided_at)}</span>
      <Badge variant={row.outcome === 'upheld' ? 'success' : 'neutral'}>
        {row.outcome ?? NONE}
      </Badge>
    </Cluster>
  {:else}
    <Button size="sm" variant="secondary" onclick={() => openDecide(row)}>
      {t['platform.privacy.decideAction']()}
    </Button>
  {/if}
{/snippet}

{#snippet incidentActionsCell(row: IncidentRow)}
  <Button size="sm" variant="secondary" onclick={() => openObligations(row)}>
    {t['platform.privacy.obligationsAction']()}
  </Button>
{/snippet}

{#snippet retentionActionsCell(row: RetentionRow)}
  <Button size="sm" variant="secondary" onclick={() => openRetention(row)}>
    {t['platform.privacy.retentionEditAction']()}
  </Button>
{/snippet}

{#snippet subprocessorNameCell(row: SubProcessorRow)}
  <span class={row.removed_at ? 'sanvi-privacy__removed' : ''}>{row.name}</span>
{/snippet}

{#snippet subprocessorActionsCell(row: SubProcessorRow)}
  {#if !row.removed_at}
    <Button
      size="sm"
      variant="secondary"
      loading={removingSubprocessor === row.name}
      onclick={() => handleRemoveSubprocessor(row.name)}
    >
      {t['platform.privacy.subRemoveAction']()}
    </Button>
  {/if}
{/snippet}

<svelte:head>
  <title>{t['platform.privacy.pageTitle']()}</title>
</svelte:head>

<DetailShell
  title={t['platform.privacy.pageTitle']()}
  subtitle={t['platform.privacy.pageDescription']()}
  tabs={TABS}
  activeHref={activeTab}
  onNavigate={handleTabNavigate}
>
  {#if loading}
    <Spinner label={t['platform.privacy.loading']()} />
  {:else if error}
    <Alert variant="error">{error}</Alert>
    <Button variant="secondary" onclick={() => void load()}>{t['common.retry']()}</Button>
  {:else if activeTab === 'requests'}
    <Table
      columns={[
        { key: 'received_at', header: t['platform.privacy.dsrReceivedCol']() },
        { key: 'kind', header: t['platform.privacy.dsrKindCol']() },
        { key: 'jurisdiction', header: t['platform.privacy.dsrJurisdictionCol']() },
        { key: 'status', header: t['platform.privacy.dsrStatusCol'](), cell: statusCell },
        { key: 'submitted_by', header: t['platform.privacy.dsrSubmittedByCol']() },
        { key: 'due_at', header: t['platform.privacy.dsrDueCol'](), cell: dsrDueCell },
        { key: 'actions', header: t['platform.privacy.actionsHeader'](), cell: dsrActionsCell },
      ]}
      rows={dsrs}
      getRowId={(row) => row.request_id}
      caption={t['platform.privacy.requestsCaption']()}
      emptyMessage={t['platform.privacy.dsrEmpty']()}
    />
  {:else if activeTab === 'appeals'}
    <Table
      columns={[
        { key: 'request_id', header: t['platform.privacy.appealRequestCol']() },
        { key: 'reason', header: t['platform.privacy.appealReasonCol']() },
        { key: 'received_at', header: t['platform.privacy.appealReceivedCol']() },
        { key: 'due_at', header: t['platform.privacy.appealDueCol'](), cell: appealDueCell },
        { key: 'decision', header: t['platform.privacy.appealDecidedCol'](), cell: appealDecisionCell },
      ]}
      rows={appeals}
      getRowId={(row) => row.id}
      caption={t['platform.privacy.appealsCaption']()}
      emptyMessage={t['platform.privacy.appealsEmpty']()}
    />
  {:else if activeTab === 'jurisdictions'}
    <Stack gap="4">
      <Alert variant="info">{t['platform.privacy.jurisdictionsReadOnly']()}</Alert>
      <Table
        columns={[
          { key: 'code', header: t['platform.privacy.jurCodeCol']() },
          { key: 'regime', header: t['platform.privacy.jurRegimeCol']() },
          { key: 'consent_model', header: t['platform.privacy.jurConsentCol']() },
          { key: 'response_days', header: t['platform.privacy.jurResponseCol'](), align: 'end' },
          { key: 'extension_days', header: t['platform.privacy.jurExtensionCol'](), align: 'end' },
          { key: 'honours_universal_opt_out', header: t['platform.privacy.jurOptOutCol'](), cell: optOutCell },
          { key: 'authority', header: t['platform.privacy.jurAuthorityCol'](), cell: authorityCell },
        ]}
        rows={jurisdictions}
        getRowId={(row) => row.code}
        caption={t['platform.privacy.jurisdictionsCaption']()}
        emptyMessage={t['platform.privacy.jurisdictionsEmpty']()}
      />
    </Stack>
  {:else if activeTab === 'incidents'}
    <Stack gap="4">
      <div class="sanvi-privacy__toolbar">
        <h2>{t['platform.privacy.tabIncidents']()}</h2>
        <Button onclick={openRecordIncident}>{t['platform.privacy.recordIncidentAction']()}</Button>
      </div>
      <Table
        columns={[
          { key: 'discovered_at', header: t['platform.privacy.incidentDiscoveredCol']() },
          { key: 'subjects', header: t['platform.privacy.incidentSubjectsCol'](), align: 'end', cell: subjectsCell },
          { key: 'tenants', header: t['platform.privacy.incidentTenantsCol'](), align: 'end', cell: tenantsCell },
          { key: 'data_classes', header: t['platform.privacy.incidentDataClassesCol'](), cell: dataClassesCell },
          { key: 'encrypted_at_rest', header: t['platform.privacy.incidentEncryptedCol'](), cell: encryptedCell },
          { key: 'actions', header: t['platform.privacy.actionsHeader'](), cell: incidentActionsCell },
        ]}
        rows={incidents}
        getRowId={(row) => row.id}
        caption={t['platform.privacy.incidentsCaption']()}
        emptyMessage={t['platform.privacy.incidentsEmpty']()}
      />
    </Stack>
  {:else if activeTab === 'retention'}
    <Table
      columns={[
        { key: 'data_class', header: t['platform.privacy.retentionDataClassCol']() },
        { key: 'sensitivity', header: t['platform.privacy.retentionSensitivityCol']() },
        { key: 'period_days', header: t['platform.privacy.retentionPeriodCol'](), align: 'end' },
        { key: 'action', header: t['platform.privacy.retentionActionCol']() },
        { key: 'basis', header: t['platform.privacy.retentionBasisCol'](), cell: basisCell },
        { key: 'disclosed_in_notice', header: t['platform.privacy.retentionDisclosedCol'](), cell: disclosedCell },
        { key: 'actions', header: t['platform.privacy.actionsHeader'](), cell: retentionActionsCell },
      ]}
      rows={retentionRules}
      getRowId={(row) => `${row.data_class}:${row.sensitivity}`}
      caption={t['platform.privacy.retentionCaption']()}
      emptyMessage={t['platform.privacy.retentionEmpty']()}
    />
  {:else if activeTab === 'subprocessors'}
    <Stack gap="4">
      <div class="sanvi-privacy__toolbar">
        <h2>{t['platform.privacy.tabSubprocessors']()}</h2>
        <Button onclick={openAddSubprocessor}>{t['platform.privacy.subAddAction']()}</Button>
      </div>
      <Table
        columns={[
          { key: 'name', header: t['platform.privacy.subNameCol'](), cell: subprocessorNameCell },
          { key: 'role', header: t['platform.privacy.subRoleCol']() },
          { key: 'location', header: t['platform.privacy.subLocationCol']() },
          { key: 'purpose', header: t['platform.privacy.subPurposeCol']() },
          { key: 'transfer_mechanism', header: t['platform.privacy.subTransferCol'](), cell: transferCell },
          { key: 'added_at', header: t['platform.privacy.subAddedCol']() },
          { key: 'removed_at', header: t['platform.privacy.subRemovedCol'](), cell: removedCell },
          { key: 'actions', header: t['platform.privacy.actionsHeader'](), cell: subprocessorActionsCell },
        ]}
        rows={subprocessors}
        getRowId={(row) => row.name}
        caption={t['platform.privacy.subprocessorsCaption']()}
        emptyMessage={t['platform.privacy.subprocessorsEmpty']()}
      />
    </Stack>
  {/if}
</DetailShell>

<Dialog bind:open={rejectOpen} titleText={t['platform.privacy.rejectTitle']()}>
  {#snippet children()}
    <Stack gap="3">
      <Field label={t['platform.privacy.reasonLabel']()} required>
        {#snippet children({ id })}
          <Textarea
            {id}
            bind:value={rejectReason}
            placeholder={t['platform.privacy.reasonPlaceholder']()}
            required
          />
        {/snippet}
      </Field>
    </Stack>
  {/snippet}
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (rejectOpen = false)}>{t['platform.privacy.cancel']()}</Button>
    <Button
      variant="danger"
      disabled={rejectReason === ''}
      loading={rejecting}
      onclick={handleReject}
    >
      {t['platform.privacy.rejectSubmit']()}
    </Button>
  {/snippet}
</Dialog>

<Dialog bind:open={decideOpen} titleText={t['platform.privacy.decideTitle']()}>
  {#snippet children()}
    <Stack gap="3">
      {#if decideError}
        <Alert variant="error">{decideError}</Alert>
      {/if}
      <fieldset class="sanvi-privacy__radio-group">
        <legend>{t['platform.privacy.outcomeLabel']()}</legend>
        <Radio name="appeal-outcome" value="upheld" bind:group={decideOutcome}>
          {t['platform.privacy.outcomeUpheld']()}
        </Radio>
        <Radio name="appeal-outcome" value="denied" bind:group={decideOutcome}>
          {t['platform.privacy.outcomeDenied']()}
        </Radio>
      </fieldset>
      <Field label={t['platform.privacy.reasonLabel']()} required>
        {#snippet children({ id })}
          <Textarea {id} bind:value={decideReason} placeholder={t['platform.privacy.reasonPlaceholder']()} required />
        {/snippet}
      </Field>
    </Stack>
  {/snippet}
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (decideOpen = false)}>{t['platform.privacy.cancel']()}</Button>
    <Button
      disabled={decideReason === ''}
      loading={decideSubmitting}
      onclick={handleDecide}
    >
      {t['platform.privacy.decideSubmit']()}
    </Button>
  {/snippet}
</Dialog>

<Dialog bind:open={incidentOpen} titleText={t['platform.privacy.recordIncidentTitle']()}>
  {#snippet children()}
    <Stack gap="3">
      <Field label={t['platform.privacy.discoveredLabel']()} required>
        {#snippet children({ id })}
          <!-- `Input` only accepts text-like types, so datetime-local and
               number fall back to raw inputs styled with the same tokens. -->
          <input
            {id}
            class="sanvi-privacy__input"
            type="datetime-local"
            bind:value={incidentDiscoveredAt}
            required
          />
        {/snippet}
      </Field>
      <Field label={t['platform.privacy.subjectsLabel']()} required>
        {#snippet children({ id })}
          <input
            {id}
            class="sanvi-privacy__input"
            type="number"
            min="0"
            step="1"
            bind:value={incidentSubjects}
            required
          />
        {/snippet}
      </Field>
      <Field label={t['platform.privacy.tenantsLabel']()} required>
        {#snippet children({ id })}
          <input
            {id}
            class="sanvi-privacy__input"
            type="number"
            min="0"
            step="1"
            bind:value={incidentTenants}
            required
          />
        {/snippet}
      </Field>
      <Field label={t['platform.privacy.jurisdictionsLabel']()} required>
        {#snippet children({ id })}
          <Input
            {id}
            bind:value={incidentJurisdictions}
            placeholder={t['platform.privacy.jurisdictionsPlaceholder']()}
            invalid={incidentJurisdictionsInvalid}
            required
          />
        {/snippet}
      </Field>
      <Field label={t['platform.privacy.dataClassLabel']()} required>
        {#snippet children({ id })}
          <Select
            {id}
            bind:value={incidentDataClass}
            options={DATA_CLASS_OPTIONS}
            placeholder={t['platform.privacy.dataClassPlaceholder']()}
            required
          />
        {/snippet}
      </Field>
      <Checkbox bind:checked={incidentEncrypted}>{t['platform.privacy.encryptedLabel']()}</Checkbox>
    </Stack>
  {/snippet}
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (incidentOpen = false)}>{t['platform.privacy.cancel']()}</Button>
    <Button
      disabled={recordIncidentDisabled}
      loading={recordingIncident}
      onclick={handleRecordIncident}
    >
      {t['platform.privacy.recordIncidentSubmit']()}
    </Button>
  {/snippet}
</Dialog>

<Dialog bind:open={obligationsOpen} titleText={t['platform.privacy.obligationsTitle']()}>
  {#snippet children()}
    <Stack gap="3">
      {#if obligationsLoading}
        <Spinner label={t['platform.privacy.loading']()} size="sm" />
      {:else if obligationsError}
        <Alert variant="error">{obligationsError}</Alert>
      {:else if obligations.length === 0}
        <p class="sanvi-privacy__muted">{t['platform.privacy.obligationsEmpty']()}</p>
      {:else}
        <Table
          columns={[
            { key: 'jurisdiction', header: t['platform.privacy.obligationsJurisdictionCol']() },
            { key: 'audience', header: t['platform.privacy.obligationsAudienceCol']() },
            { key: 'due_at', header: t['platform.privacy.obligationsDueCol'](), cell: obligationDueCell },
            { key: 'notified_at', header: t['platform.privacy.obligationsNotifiedCol'](), cell: notifiedCell },
            {
              key: 'suppressed_by_encryption',
              header: t['platform.privacy.obligationsSuppressedCol'](),
              cell: suppressedCell,
            },
            { key: 'actions', header: t['platform.privacy.actionsHeader'](), cell: obligationActionsCell },
          ]}
          rows={obligations}
          getRowId={(row) => obligationKey(row)}
        />
      {/if}
    </Stack>
  {/snippet}
</Dialog>

<Dialog bind:open={retentionOpen} titleText={t['platform.privacy.retentionEditTitle']()}>
  {#snippet children()}
    <Stack gap="3">
      <Field label={t['platform.privacy.periodLabel']()} required>
        {#snippet children({ id })}
          <input
            {id}
            class="sanvi-privacy__input"
            type="number"
            min="0"
            step="1"
            bind:value={retentionPeriodDays}
            required
          />
        {/snippet}
      </Field>
      <Field label={t['platform.privacy.actionLabel']()} required>
        {#snippet children({ id })}
          <Select {id} bind:value={retentionAction} options={RETENTION_ACTION_OPTIONS} />
        {/snippet}
      </Field>
      <Checkbox bind:checked={retentionDisclosed}>{t['platform.privacy.disclosedLabel']()}</Checkbox>
    </Stack>
  {/snippet}
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (retentionOpen = false)}>{t['platform.privacy.cancel']()}</Button>
    <Button disabled={retentionPeriodDays < 0} loading={savingRetention} onclick={handleSaveRetention}>
      {t['platform.privacy.retentionSave']()}
    </Button>
  {/snippet}
</Dialog>

<Dialog bind:open={subAddOpen} titleText={t['platform.privacy.subAddTitle']()}>
  {#snippet children()}
    <Stack gap="3">
      <Field label={t['platform.privacy.nameLabel']()} required>
        {#snippet children({ id })}
          <Input {id} bind:value={subName} placeholder={t['platform.privacy.namePlaceholder']()} required />
        {/snippet}
      </Field>
      <Field label={t['platform.privacy.roleLabel']()} required>
        {#snippet children({ id })}
          <Select
            {id}
            bind:value={subRole}
            options={SUBPROCESSOR_ROLE_OPTIONS}
            placeholder={t['platform.privacy.rolePlaceholder']()}
            required
          />
        {/snippet}
      </Field>
      <Field label={t['platform.privacy.locationLabel']()} required>
        {#snippet children({ id })}
          <Input {id} bind:value={subLocation} placeholder={t['platform.privacy.locationPlaceholder']()} required />
        {/snippet}
      </Field>
      <Field label={t['platform.privacy.purposeLabel']()} required>
        {#snippet children({ id })}
          <Textarea {id} bind:value={subPurpose} placeholder={t['platform.privacy.purposePlaceholder']()} required />
        {/snippet}
      </Field>
    </Stack>
  {/snippet}
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (subAddOpen = false)}>{t['platform.privacy.cancel']()}</Button>
    <Button
      disabled={!subName || !subRole || !subLocation || !subPurpose}
      loading={savingSubprocessor}
      onclick={handleAddSubprocessor}
    >
      {t['platform.privacy.subAddSubmit']()}
    </Button>
  {/snippet}
</Dialog>

<style>
  .sanvi-privacy__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .sanvi-privacy__toolbar h2 {
    margin: 0;
    font-size: var(--sanvi-font-size-lg);
  }

  /* Same treatment as @sanvi/ui's `Input`, which only accepts text-like
     types — datetime-local and number inputs need raw elements. */
  .sanvi-privacy__input {
    width: 100%;
    padding: var(--sanvi-spacing-2) var(--sanvi-spacing-3);
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-md);
    background: var(--sanvi-color-background-primary);
    color: var(--sanvi-color-text-primary);
    font-size: var(--sanvi-font-size-md);
  }

  .sanvi-privacy__radio-group {
    display: flex;
    gap: var(--sanvi-spacing-4);
    padding: 0;
    margin: 0;
    border: none;
  }

  .sanvi-privacy__radio-group legend {
    padding: 0;
    margin-block-end: var(--sanvi-spacing-2);
    font-size: var(--sanvi-font-size-sm);
    font-weight: var(--sanvi-font-weight-medium);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-privacy__muted {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-privacy__removed {
    text-decoration: line-through;
    color: var(--sanvi-color-text-secondary);
  }
</style>
