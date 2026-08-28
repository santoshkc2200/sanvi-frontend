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

const COPY = {
  pageTitle: 'Privacy & Consent',
  pageDescription:
    'DSR queue, appeals, jurisdictions, breach incidents, retention, sub-processors.',
  loading: 'Loading privacy console',
  loadError: 'Could not load privacy data. Please try again in a moment.',
  retry: 'Try again',
  tabRequests: 'Requests',
  tabAppeals: 'Appeals',
  tabJurisdictions: 'Jurisdictions',
  tabIncidents: 'Incidents',
  tabRetention: 'Retention',
  tabSubprocessors: 'Sub-processors',
  yes: 'Yes',
  no: 'No',
  none: '—',
  overdue: 'Overdue',
  dataClassSeparator: ', ',
  actionsHeader: 'Actions',
  cancel: 'Cancel',
  empty: 'Nothing here yet.',
  genericActionError: 'Something went wrong. Please try again.',

  // Requests tab
  requestsCaption: 'Data subject requests',
  dsrReceivedCol: 'Received',
  dsrKindCol: 'Kind',
  dsrJurisdictionCol: 'Jurisdiction',
  dsrStatusCol: 'Status',
  dsrSubmittedByCol: 'Submitted by',
  dsrDueCol: 'Due',
  dsrEmpty: 'No data subject requests.',
  extendAction: 'Extend',
  extendSuccess: 'Deadline extended.',
  extendError: 'Could not extend this request.',
  rejectAction: 'Reject',
  rejectTitle: 'Reject request',
  reasonLabel: 'Reason',
  reasonPlaceholder: 'Shown to the subject; US requests get the appeal route.',
  rejectSubmit: 'Reject request',
  rejectSuccess: 'Request rejected.',
  rejectError: 'Could not reject this request.',

  // Appeals tab
  appealsCaption: 'Open appeals',
  appealRequestCol: 'Request',
  appealReasonCol: 'Reason',
  appealReceivedCol: 'Received',
  appealDueCol: 'Due',
  appealDecidedCol: 'Decided',
  appealOutcomeCol: 'Outcome',
  appealsEmpty: 'No open appeals.',
  decideAction: 'Decide',
  decideTitle: 'Decide appeal',
  outcomeLabel: 'Outcome',
  outcomeUpheld: 'Upheld',
  outcomeDenied: 'Denied',
  decideSubmit: 'Record decision',
  decideSuccess: 'Decision recorded.',
  decideError: 'Could not record this decision.',
  selfReviewError:
    'This appeal cannot be decided by the operator who decided the original request.',

  // Jurisdictions tab
  jurisdictionsCaption: 'Jurisdiction profiles',
  jurCodeCol: 'Code',
  jurRegimeCol: 'Regime',
  jurConsentCol: 'Consent model',
  jurResponseCol: 'Response days',
  jurExtensionCol: 'Extension days',
  jurOptOutCol: 'Universal opt-out honoured',
  jurAuthorityCol: 'Authority',
  jurisdictionsEmpty: 'No jurisdiction profiles configured.',
  jurisdictionsReadOnly:
    'Profiles are read-mostly: edits go through the API for now, so every change lands on the audit trail with an operator identity attached.',

  // Incidents tab
  incidentsCaption: 'Breach incidents',
  incidentDiscoveredCol: 'Discovered',
  incidentSubjectsCol: 'Subjects',
  incidentTenantsCol: 'Tenants',
  incidentDataClassesCol: 'Data classes',
  incidentEncryptedCol: 'Encrypted at rest',
  incidentsEmpty: 'No incidents recorded.',
  recordIncidentAction: 'Record incident',
  recordIncidentTitle: 'Record breach incident',
  discoveredLabel: 'Discovered at',
  subjectsLabel: 'Subjects affected',
  tenantsLabel: 'Tenants affected',
  jurisdictionsLabel: 'Jurisdictions',
  jurisdictionsPlaceholder: 'eu, us-ca',
  dataClassLabel: 'Data class',
  dataClassPlaceholder: 'Select a data class',
  encryptedLabel: 'Data encrypted at rest',
  recordIncidentSubmit: 'Record incident',
  recordIncidentSuccess: 'Incident recorded.',
  recordIncidentError: 'Could not record this incident.',
  obligationsAction: 'Obligations',
  obligationsTitle: 'Notification obligations',
  obligationsJurisdictionCol: 'Jurisdiction',
  obligationsAudienceCol: 'Audience',
  obligationsDueCol: 'Due',
  obligationsNotifiedCol: 'Notified',
  obligationsSuppressedCol: 'Suppressed by encryption',
  obligationsEmpty: 'No notification obligations computed.',
  obligationsError: 'Could not load obligations.',
  markNotifiedAction: 'Mark notified',
  notifiedSuccess: 'Obligation marked notified.',
  notifiedError: 'Could not mark this obligation notified.',

  // Retention tab
  retentionCaption: 'Retention rules',
  retentionDataClassCol: 'Data class',
  retentionSensitivityCol: 'Sensitivity',
  retentionPeriodCol: 'Period (days)',
  retentionActionCol: 'Action',
  retentionBasisCol: 'Basis',
  retentionDisclosedCol: 'Disclosed in notice',
  retentionEmpty: 'No retention rules configured.',
  retentionEditAction: 'Edit',
  retentionEditTitle: 'Edit retention rule',
  periodLabel: 'Period (days)',
  actionLabel: 'Action',
  disclosedLabel: 'Disclosed in privacy notice',
  retentionSave: 'Save rule',
  retentionSuccess: 'Retention rule saved.',
  retentionError: 'Could not save this retention rule.',

  // Sub-processors tab
  subprocessorsCaption: 'Sub-processor registry',
  subNameCol: 'Name',
  subRoleCol: 'Role',
  subLocationCol: 'Location',
  subPurposeCol: 'Purpose',
  subTransferCol: 'Transfer mechanism',
  subAddedCol: 'Added',
  subRemovedCol: 'Removed',
  subprocessorsEmpty: 'No sub-processors registered.',
  subAddAction: 'Add sub-processor',
  subAddTitle: 'Add sub-processor',
  nameLabel: 'Name',
  namePlaceholder: 'Acme Analytics',
  roleLabel: 'Role',
  rolePlaceholder: 'Select a role',
  locationLabel: 'Location',
  locationPlaceholder: 'Frankfurt, Germany',
  purposeLabel: 'Purpose',
  purposePlaceholder: 'Product analytics',
  subAddSubmit: 'Add sub-processor',
  subAddSuccess: 'Sub-processor saved.',
  subAddError: 'Could not save this sub-processor.',
  subRemoveAction: 'Remove',
  subRemoveSuccess: 'Sub-processor removed.',
  subRemoveError: 'Could not remove this sub-processor.',
}

const TABS: DetailShellTab[] = [
  { href: 'requests', label: COPY.tabRequests },
  { href: 'appeals', label: COPY.tabAppeals },
  { href: 'jurisdictions', label: COPY.tabJurisdictions },
  { href: 'incidents', label: COPY.tabIncidents },
  { href: 'retention', label: COPY.tabRetention },
  { href: 'subprocessors', label: COPY.tabSubprocessors },
]

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
    error = COPY.loadError
  } finally {
    if (seq === loadSeq) loading = false
  }
}

$effect(() => {
  void load()
})

function formatDateTime(value?: string | null): string {
  if (!value) return COPY.none
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return value
  }
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
    showToast({ variant: 'success', title: COPY.extendSuccess })
    await load()
  } catch (err) {
    showToast({
      variant: 'error',
      title: COPY.extendError,
      description: errorDetail(err) ?? COPY.genericActionError,
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
    showToast({ variant: 'success', title: COPY.rejectSuccess })
    await load()
  } catch (err) {
    showToast({
      variant: 'error',
      title: COPY.rejectError,
      description: errorDetail(err) ?? COPY.genericActionError,
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
    showToast({ variant: 'success', title: COPY.decideSuccess })
    await load()
  } catch (err) {
    // 409 here means the operator decided the original request — a
    // two-person rule, not a transient fault. Surface the problem detail
    // inline so the operator understands why the action is refused.
    decideError =
      err instanceof ApiError
        ? (err.detail ?? (err.status === 409 ? COPY.selfReviewError : err.title))
        : COPY.decideError
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
    showToast({ variant: 'success', title: COPY.recordIncidentSuccess })
    await load()
  } catch (err) {
    showToast({
      variant: 'error',
      title: COPY.recordIncidentError,
      description: errorDetail(err) ?? COPY.genericActionError,
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
    obligationsError = COPY.obligationsError
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
    showToast({ variant: 'success', title: COPY.notifiedSuccess })
    await loadObligations()
  } catch (err) {
    showToast({
      variant: 'error',
      title: COPY.notifiedError,
      description: errorDetail(err) ?? COPY.genericActionError,
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
      basis: null,
      disclosed_in_notice: retentionDisclosed,
    })
    retentionOpen = false
    showToast({ variant: 'success', title: COPY.retentionSuccess })
    await load()
  } catch (err) {
    showToast({
      variant: 'error',
      title: COPY.retentionError,
      description: errorDetail(err) ?? COPY.genericActionError,
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
    await upsertSubprocessor(apiClient, {
      name: subName,
      role: subRole,
      location: subLocation,
      purpose: subPurpose,
      contract_terms: null,
      transfer_mechanism: null,
    })
    subAddOpen = false
    showToast({ variant: 'success', title: COPY.subAddSuccess })
    await load()
  } catch (err) {
    showToast({
      variant: 'error',
      title: COPY.subAddError,
      description: errorDetail(err) ?? COPY.genericActionError,
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
    showToast({ variant: 'success', title: COPY.subRemoveSuccess })
    await load()
  } catch (err) {
    showToast({
      variant: 'error',
      title: COPY.subRemoveError,
      description: errorDetail(err) ?? COPY.genericActionError,
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
      <Badge variant="warning">{COPY.overdue}</Badge>
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
      {COPY.extendAction}
    </Button>
    <Button size="sm" variant="secondary" onclick={() => openReject(row)}>
      {COPY.rejectAction}
    </Button>
  </Cluster>
{/snippet}

{#snippet optOutCell(row: JurisdictionRow)}
  {row.honours_universal_opt_out ? COPY.yes : COPY.no}
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
  {row.data_classes.join(COPY.dataClassSeparator)}
{/snippet}

{#snippet encryptedCell(row: IncidentRow)}
  {row.encrypted_at_rest ? COPY.yes : COPY.no}
{/snippet}

{#snippet basisCell(row: RetentionRow)}
  {row.basis ?? COPY.none}
{/snippet}

{#snippet disclosedCell(row: RetentionRow)}
  {row.disclosed_in_notice ? COPY.yes : COPY.no}
{/snippet}

{#snippet transferCell(row: SubProcessorRow)}
  {row.transfer_mechanism ?? COPY.none}
{/snippet}

{#snippet removedCell(row: SubProcessorRow)}
  {row.removed_at ? formatDateTime(row.removed_at) : COPY.none}
{/snippet}

{#snippet obligationDueCell(row: ObligationRow)}
  {@render dueCell(row.due_at, !row.notified_at && isPastDue(row.due_at))}
{/snippet}

{#snippet notifiedCell(row: ObligationRow)}
  {row.notified_at ? formatDateTime(row.notified_at) : COPY.none}
{/snippet}

{#snippet suppressedCell(row: ObligationRow)}
  {row.suppressed_by_encryption ? COPY.yes : COPY.no}
{/snippet}

{#snippet obligationActionsCell(row: ObligationRow)}
  {#if !row.notified_at}
    <Button
      size="sm"
      variant="secondary"
      loading={notifyingKey === obligationKey(row)}
      onclick={() => handleMarkNotified(row)}
    >
      {COPY.markNotifiedAction}
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
        {row.outcome ?? COPY.none}
      </Badge>
    </Cluster>
  {:else}
    <Button size="sm" variant="secondary" onclick={() => openDecide(row)}>
      {COPY.decideAction}
    </Button>
  {/if}
{/snippet}

{#snippet incidentActionsCell(row: IncidentRow)}
  <Button size="sm" variant="secondary" onclick={() => openObligations(row)}>
    {COPY.obligationsAction}
  </Button>
{/snippet}

{#snippet retentionActionsCell(row: RetentionRow)}
  <Button size="sm" variant="secondary" onclick={() => openRetention(row)}>
    {COPY.retentionEditAction}
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
      {COPY.subRemoveAction}
    </Button>
  {/if}
{/snippet}

<svelte:head>
  <title>{COPY.pageTitle}</title>
</svelte:head>

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
    <Button variant="secondary" onclick={() => void load()}>{COPY.retry}</Button>
  {:else if activeTab === 'requests'}
    <Table
      columns={[
        { key: 'received_at', header: COPY.dsrReceivedCol },
        { key: 'kind', header: COPY.dsrKindCol },
        { key: 'jurisdiction', header: COPY.dsrJurisdictionCol },
        { key: 'status', header: COPY.dsrStatusCol, cell: statusCell },
        { key: 'submitted_by', header: COPY.dsrSubmittedByCol },
        { key: 'due_at', header: COPY.dsrDueCol, cell: dsrDueCell },
        { key: 'actions', header: COPY.actionsHeader, cell: dsrActionsCell },
      ]}
      rows={dsrs}
      getRowId={(row) => row.request_id}
      caption={COPY.requestsCaption}
      emptyMessage={COPY.dsrEmpty}
    />
  {:else if activeTab === 'appeals'}
    <Table
      columns={[
        { key: 'request_id', header: COPY.appealRequestCol },
        { key: 'reason', header: COPY.appealReasonCol },
        { key: 'received_at', header: COPY.appealReceivedCol },
        { key: 'due_at', header: COPY.appealDueCol, cell: appealDueCell },
        { key: 'decision', header: COPY.appealDecidedCol, cell: appealDecisionCell },
      ]}
      rows={appeals}
      getRowId={(row) => row.id}
      caption={COPY.appealsCaption}
      emptyMessage={COPY.appealsEmpty}
    />
  {:else if activeTab === 'jurisdictions'}
    <Stack gap="4">
      <Alert variant="info">{COPY.jurisdictionsReadOnly}</Alert>
      <Table
        columns={[
          { key: 'code', header: COPY.jurCodeCol },
          { key: 'regime', header: COPY.jurRegimeCol },
          { key: 'consent_model', header: COPY.jurConsentCol },
          { key: 'response_days', header: COPY.jurResponseCol, align: 'end' },
          { key: 'extension_days', header: COPY.jurExtensionCol, align: 'end' },
          { key: 'honours_universal_opt_out', header: COPY.jurOptOutCol, cell: optOutCell },
          { key: 'authority', header: COPY.jurAuthorityCol, cell: authorityCell },
        ]}
        rows={jurisdictions}
        getRowId={(row) => row.code}
        caption={COPY.jurisdictionsCaption}
        emptyMessage={COPY.jurisdictionsEmpty}
      />
    </Stack>
  {:else if activeTab === 'incidents'}
    <Stack gap="4">
      <div class="sanvi-privacy__toolbar">
        <h2>{COPY.tabIncidents}</h2>
        <Button onclick={openRecordIncident}>{COPY.recordIncidentAction}</Button>
      </div>
      <Table
        columns={[
          { key: 'discovered_at', header: COPY.incidentDiscoveredCol },
          { key: 'subjects', header: COPY.incidentSubjectsCol, align: 'end', cell: subjectsCell },
          { key: 'tenants', header: COPY.incidentTenantsCol, align: 'end', cell: tenantsCell },
          { key: 'data_classes', header: COPY.incidentDataClassesCol, cell: dataClassesCell },
          { key: 'encrypted_at_rest', header: COPY.incidentEncryptedCol, cell: encryptedCell },
          { key: 'actions', header: COPY.actionsHeader, cell: incidentActionsCell },
        ]}
        rows={incidents}
        getRowId={(row) => row.id}
        caption={COPY.incidentsCaption}
        emptyMessage={COPY.incidentsEmpty}
      />
    </Stack>
  {:else if activeTab === 'retention'}
    <Table
      columns={[
        { key: 'data_class', header: COPY.retentionDataClassCol },
        { key: 'sensitivity', header: COPY.retentionSensitivityCol },
        { key: 'period_days', header: COPY.retentionPeriodCol, align: 'end' },
        { key: 'action', header: COPY.retentionActionCol },
        { key: 'basis', header: COPY.retentionBasisCol, cell: basisCell },
        { key: 'disclosed_in_notice', header: COPY.retentionDisclosedCol, cell: disclosedCell },
        { key: 'actions', header: COPY.actionsHeader, cell: retentionActionsCell },
      ]}
      rows={retentionRules}
      getRowId={(row) => `${row.data_class}:${row.sensitivity}`}
      caption={COPY.retentionCaption}
      emptyMessage={COPY.retentionEmpty}
    />
  {:else if activeTab === 'subprocessors'}
    <Stack gap="4">
      <div class="sanvi-privacy__toolbar">
        <h2>{COPY.tabSubprocessors}</h2>
        <Button onclick={openAddSubprocessor}>{COPY.subAddAction}</Button>
      </div>
      <Table
        columns={[
          { key: 'name', header: COPY.subNameCol, cell: subprocessorNameCell },
          { key: 'role', header: COPY.subRoleCol },
          { key: 'location', header: COPY.subLocationCol },
          { key: 'purpose', header: COPY.subPurposeCol },
          { key: 'transfer_mechanism', header: COPY.subTransferCol, cell: transferCell },
          { key: 'added_at', header: COPY.subAddedCol },
          { key: 'removed_at', header: COPY.subRemovedCol, cell: removedCell },
          { key: 'actions', header: COPY.actionsHeader, cell: subprocessorActionsCell },
        ]}
        rows={subprocessors}
        getRowId={(row) => row.name}
        caption={COPY.subprocessorsCaption}
        emptyMessage={COPY.subprocessorsEmpty}
      />
    </Stack>
  {/if}
</DetailShell>

<Dialog bind:open={rejectOpen} titleText={COPY.rejectTitle}>
  {#snippet children()}
    <Stack gap="3">
      <Field label={COPY.reasonLabel} required>
        {#snippet children({ id })}
          <Textarea
            {id}
            bind:value={rejectReason}
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
      disabled={rejectReason === ''}
      loading={rejecting}
      onclick={handleReject}
    >
      {COPY.rejectSubmit}
    </Button>
  {/snippet}
</Dialog>

<Dialog bind:open={decideOpen} titleText={COPY.decideTitle}>
  {#snippet children()}
    <Stack gap="3">
      {#if decideError}
        <Alert variant="error">{decideError}</Alert>
      {/if}
      <fieldset class="sanvi-privacy__radio-group">
        <legend>{COPY.outcomeLabel}</legend>
        <Radio name="appeal-outcome" value="upheld" bind:group={decideOutcome}>
          {COPY.outcomeUpheld}
        </Radio>
        <Radio name="appeal-outcome" value="denied" bind:group={decideOutcome}>
          {COPY.outcomeDenied}
        </Radio>
      </fieldset>
      <Field label={COPY.reasonLabel} required>
        {#snippet children({ id })}
          <Textarea {id} bind:value={decideReason} placeholder={COPY.reasonPlaceholder} required />
        {/snippet}
      </Field>
    </Stack>
  {/snippet}
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (decideOpen = false)}>{COPY.cancel}</Button>
    <Button
      disabled={decideReason === ''}
      loading={decideSubmitting}
      onclick={handleDecide}
    >
      {COPY.decideSubmit}
    </Button>
  {/snippet}
</Dialog>

<Dialog bind:open={incidentOpen} titleText={COPY.recordIncidentTitle}>
  {#snippet children()}
    <Stack gap="3">
      <Field label={COPY.discoveredLabel} required>
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
      <Field label={COPY.subjectsLabel} required>
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
      <Field label={COPY.tenantsLabel} required>
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
      <Field label={COPY.jurisdictionsLabel} required>
        {#snippet children({ id })}
          <Input
            {id}
            bind:value={incidentJurisdictions}
            placeholder={COPY.jurisdictionsPlaceholder}
            invalid={incidentJurisdictionsInvalid}
            required
          />
        {/snippet}
      </Field>
      <Field label={COPY.dataClassLabel} required>
        {#snippet children({ id })}
          <Select
            {id}
            bind:value={incidentDataClass}
            options={DATA_CLASS_OPTIONS}
            placeholder={COPY.dataClassPlaceholder}
            required
          />
        {/snippet}
      </Field>
      <Checkbox bind:checked={incidentEncrypted}>{COPY.encryptedLabel}</Checkbox>
    </Stack>
  {/snippet}
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (incidentOpen = false)}>{COPY.cancel}</Button>
    <Button
      disabled={recordIncidentDisabled}
      loading={recordingIncident}
      onclick={handleRecordIncident}
    >
      {COPY.recordIncidentSubmit}
    </Button>
  {/snippet}
</Dialog>

<Dialog bind:open={obligationsOpen} titleText={COPY.obligationsTitle}>
  {#snippet children()}
    <Stack gap="3">
      {#if obligationsLoading}
        <Spinner label={COPY.loading} size="sm" />
      {:else if obligationsError}
        <Alert variant="error">{obligationsError}</Alert>
      {:else if obligations.length === 0}
        <p class="sanvi-privacy__muted">{COPY.obligationsEmpty}</p>
      {:else}
        <Table
          columns={[
            { key: 'jurisdiction', header: COPY.obligationsJurisdictionCol },
            { key: 'audience', header: COPY.obligationsAudienceCol },
            { key: 'due_at', header: COPY.obligationsDueCol, cell: obligationDueCell },
            { key: 'notified_at', header: COPY.obligationsNotifiedCol, cell: notifiedCell },
            {
              key: 'suppressed_by_encryption',
              header: COPY.obligationsSuppressedCol,
              cell: suppressedCell,
            },
            { key: 'actions', header: COPY.actionsHeader, cell: obligationActionsCell },
          ]}
          rows={obligations}
          getRowId={(row) => obligationKey(row)}
        />
      {/if}
    </Stack>
  {/snippet}
</Dialog>

<Dialog bind:open={retentionOpen} titleText={COPY.retentionEditTitle}>
  {#snippet children()}
    <Stack gap="3">
      <Field label={COPY.periodLabel} required>
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
      <Field label={COPY.actionLabel} required>
        {#snippet children({ id })}
          <Select {id} bind:value={retentionAction} options={RETENTION_ACTION_OPTIONS} />
        {/snippet}
      </Field>
      <Checkbox bind:checked={retentionDisclosed}>{COPY.disclosedLabel}</Checkbox>
    </Stack>
  {/snippet}
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (retentionOpen = false)}>{COPY.cancel}</Button>
    <Button disabled={retentionPeriodDays < 0} loading={savingRetention} onclick={handleSaveRetention}>
      {COPY.retentionSave}
    </Button>
  {/snippet}
</Dialog>

<Dialog bind:open={subAddOpen} titleText={COPY.subAddTitle}>
  {#snippet children()}
    <Stack gap="3">
      <Field label={COPY.nameLabel} required>
        {#snippet children({ id })}
          <Input {id} bind:value={subName} placeholder={COPY.namePlaceholder} required />
        {/snippet}
      </Field>
      <Field label={COPY.roleLabel} required>
        {#snippet children({ id })}
          <Select
            {id}
            bind:value={subRole}
            options={SUBPROCESSOR_ROLE_OPTIONS}
            placeholder={COPY.rolePlaceholder}
            required
          />
        {/snippet}
      </Field>
      <Field label={COPY.locationLabel} required>
        {#snippet children({ id })}
          <Input {id} bind:value={subLocation} placeholder={COPY.locationPlaceholder} required />
        {/snippet}
      </Field>
      <Field label={COPY.purposeLabel} required>
        {#snippet children({ id })}
          <Textarea {id} bind:value={subPurpose} placeholder={COPY.purposePlaceholder} required />
        {/snippet}
      </Field>
    </Stack>
  {/snippet}
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (subAddOpen = false)}>{COPY.cancel}</Button>
    <Button
      disabled={!subName || !subRole || !subLocation || !subPurpose}
      loading={savingSubprocessor}
      onclick={handleAddSubprocessor}
    >
      {COPY.subAddSubmit}
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
