<script lang="ts">
import {
  ApiError,
  addAdAdGroup,
  createAdCampaign,
  getAdCampaign,
  listAdConnections,
  listAdPlatforms,
  patchAdCampaign,
  validateAdCampaign,
} from '@sanvi/api-client'
import type {
  CampaignView,
  ConnectionView,
  CreateCampaignRequest,
  PatchCampaignRequest,
  PlatformView,
  ValidationViolation,
} from '@sanvi/api-client'
import { can } from '@sanvi/auth'
import { t } from '@sanvi/i18n'
import { navigate } from '@sanvi/spa-router'
import { getActiveTenantId } from '@sanvi/tenant'
import {
  Alert,
  Button,
  CapabilityForm,
  Cluster,
  Container,
  Dialog,
  EmptyState,
  formatAdCurrency,
  humanizeOptionValue,
  showToast,
  Spinner,
  Stack,
  StepperNav,
  builderAutosaveKey,
  builderSteps,
  campaignFormSchema,
  clearBuilderAutosave,
  draftFromCampaign,
  draftToCreatePayload,
  draftToPatchPayload,
  emptyDraft,
  loadBuilderAutosave,
  saveBuilderAutosave,
  seedAdGroupPayload,
  validateStep,
  type AdCapabilityMatrix,
  type BuilderSchedule,
  type BuilderStepId,
  type CampaignFormDraft,
  type ServerViolation,
} from '@sanvi/ui'
import { apiClient } from '../../lib/api'
import {
  budgetIncrease,
  dataLabel,
  money,
  BUDGET_CONFIRM_INCREASE_RATIO,
} from '../../lib/advertising/campaigns'

/**
 * The campaign builder (phase 10, TASK-012) — TASK-010's form engine split
 * across a stepper. Every field, option, limit, and minimum comes from the
 * live capability matrix of the connection's platform; no step names an
 * objective, budget kind, or dimension (the grep gate enforces it).
 *
 * Work is never lost: the draft autosaves locally (bound to the connection
 * or campaign and the matrix version it was entered under) and a refresh
 * resumes with every value intact. In edit mode each step's advance is
 * confirmed server-side with the dry-run `validate` endpoint; in create mode
 * there is no campaign to dry-run against yet, so the engine's client-side
 * validation gates each step and the backend's create response is the final
 * authority — its field violations map back onto the form.
 *
 * Money rules: the budget renders in the ad account's currency, and an
 * increase above the confirm threshold cannot be saved without a dialog
 * showing the daily and projected monthly delta in that currency. The
 * idempotency key of an in-flight submission survives retries, so a
 * timed-out create can never apply twice.
 */

interface Props {
  id?: string
}

let { id: editId }: Props = $props()

const editMode = $derived(Boolean(editId))

let loading = $state(true)
let error = $state<string | undefined>(undefined)
let entitled = $state(true)
let forbidden = $state(false)

let platforms = $state<PlatformView[]>([])
let connections = $state<ConnectionView[]>([])
let campaign = $state<CampaignView | null>(null)

let draft = $state<CampaignFormDraft | undefined>(undefined)
let schedule = $state<BuilderSchedule>({ startsAt: null, endsAt: null })
let step = $state<BuilderStepId>('basics')
let serverViolations = $state<ServerViolation[]>([])

// Connection choice (create mode): from the query param, the only active
// connection, or an explicit picker when there are several.
let connectionId = $state<string | undefined>(undefined)
const selectableConnections = $derived(
  connections.filter((candidate) => candidate.status !== 'disconnected'),
)

// Conflict (409) state — rendered, never retried.
let conflictCurrent = $state<CampaignView | null>(null)

// Budget-increase confirmation (edit mode).
let budgetConfirmOpen = $state(false)
let budgetConfirmPending = $state(false)

let submitting = $state(false)
let submitError = $state<string | undefined>(undefined)
// The idempotency key of the in-flight save; kept across retries of the
// same submission so a timed-out request cannot apply twice.
let pendingKey: string | undefined

let loadSeq = 0

const writable = $derived(can('advertising.campaign.write', getActiveTenantId()))

const connection = $derived(connections.find((candidate) => candidate.id === connectionId))
const platform = $derived<PlatformView | undefined>(
  connection ? platforms.find((candidate) => candidate.key === connection.platform) : undefined,
)
const matrix = $derived<AdCapabilityMatrix | undefined>(platform?.capability_matrix)
const schema = $derived(matrix ? campaignFormSchema(matrix, platform?.key) : undefined)

const stepIds = $derived<BuilderStepId[]>(
  schema ? builderSteps(schema, { mode: editMode ? 'edit' : 'new' }) : [],
)
const stepIndex = $derived(Math.max(0, stepIds.indexOf(step)))

const stepGroups: Partial<Record<BuilderStepId, string[]>> = {
  basics: ['basics'],
  targeting: ['targeting'],
  budget: ['budget'],
}

function stepLabel(id: BuilderStepId): string {
  return dataLabel('admin.advertising.builder.step.', id)
}

function optionLabelsFor(): Record<string, string> {
  if (!matrix) return {}
  const tMap = t as unknown as Record<string, () => string>
  const values = [...matrix.objectives, ...matrix.budget_types, ...matrix.targeting_dimensions]
  for (const placement of matrix.creative_placements) values.push(placement.key)
  return Object.fromEntries(
    values.map((value) => {
      const key = `admin.advertising.option.${value}`
      return [value, typeof tMap[key] === 'function' ? tMap[key]() : value]
    }),
  )
}

function activeConnection(): ConnectionView | undefined {
  return connections.find((candidate) => candidate.id === connectionId)
}

function autosaveKeyFor(): string | undefined {
  const owner = editMode ? editId : connectionId
  return owner ? builderAutosaveKey(editMode ? 'edit' : 'new', owner) : undefined
}

async function load(): Promise<void> {
  const seq = ++loadSeq
  loading = true
  error = undefined
  entitled = true
  forbidden = false
  conflictCurrent = null
  serverViolations = []
  submitError = undefined

  try {
    const catalog = await listAdPlatforms(apiClient)
    if (seq !== loadSeq) return
    platforms = catalog?.platforms ?? []
  } catch (err) {
    if (seq !== loadSeq) return
    if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
      entitled = false
    } else {
      error = t['admin.advertising.genericError']()
    }
    loading = false
    return
  }

  try {
    const view = await listAdConnections(apiClient)
    if (seq !== loadSeq) return
    connections = view?.connections ?? []
  } catch {
    if (seq !== loadSeq) return
    error = t['admin.advertising.campaigns.loadError']()
    loading = false
    return
  }

  if (editMode && editId) {
    try {
      const view = await getAdCampaign(apiClient, editId)
      if (seq !== loadSeq) return
      campaign = view
      connectionId = view.connection_id
    } catch (err) {
      if (seq !== loadSeq) return
      error =
        err instanceof ApiError && err.status === 404
          ? t['admin.advertising.builder.notFound']()
          : t['admin.advertising.campaigns.loadError']()
      loading = false
      return
    }
  } else {
    const query =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : undefined
    const requested = query?.get('connection') ?? undefined
    connectionId =
      (requested && selectableConnections.some((candidate) => candidate.id === requested)
        ? requested
        : undefined) ??
      (selectableConnections.length === 1 ? selectableConnections[0]?.id : undefined)
  }

  const active = activeConnection()
  if (!active) {
    // No connection chosen yet — the picker renders; there is nothing to
    // restore and no matrix to bind the draft to.
    draft = undefined
    loading = false
    return
  }

  const candidatePlatform = platforms.find((entry) => entry.key === active.platform)
  if (!candidatePlatform) {
    error = t['admin.advertising.builder.matrixMissing']()
    loading = false
    return
  }

  // Draft bootstrap — before the form renders, so the engine's bindable
  // draft starts from the restored values rather than being overwritten.
  const liveSchema = campaignFormSchema(candidatePlatform.capability_matrix, candidatePlatform.key)
  const restored = loadBuilderAutosave(
    localStorage,
    autosaveKeyFor() ?? '',
    liveSchema.matrixVersion,
  )
  if (restored && stepIdsFor(liveSchema).includes(restored.step)) {
    draft = restored.draft
    schedule = restored.schedule
    step = restored.step
  } else if (editMode && campaign) {
    const built = draftFromCampaign(campaign.campaign, liveSchema)
    draft = built.draft
    schedule = built.schedule
    step = 'basics'
  } else {
    draft = emptyDraft(liveSchema)
    schedule = { startsAt: null, endsAt: null }
    step = 'basics'
  }

  loading = false
}

function stepIdsFor(target: NonNullable<typeof schema>): BuilderStepId[] {
  return builderSteps(target, { mode: editMode ? 'edit' : 'new' })
}

// `datetime-local` only accepts `YYYY-MM-DDTHH:mm`. Values this builder wrote are
// already naive local wall-clock and just need truncating. A value carrying an
// explicit offset (or `Z`) came from another writer and is a real instant, so it is
// converted to local wall-clock first — truncating it would show a UTC time in a
// field labelled local.
function formatDatetimeLocal(value: string | null | undefined): string {
  if (!value) return ''
  if (/(?:Z|[+-]\d{2}:?\d{2})$/.test(value)) {
    const instant = new Date(value)
    if (Number.isNaN(instant.getTime())) return ''
    const pad = (part: number): string => String(part).padStart(2, '0')
    return `${instant.getFullYear()}-${pad(instant.getMonth() + 1)}-${pad(instant.getDate())}T${pad(instant.getHours())}:${pad(instant.getMinutes())}`
  }
  return value.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/)?.[1] ?? ''
}

// Continuous autosave: any draft, schedule, or step change persists. Cleared
// only by a successful submit (or an explicit discard after a conflict).
$effect(() => {
  const key = autosaveKeyFor()
  if (!key || !matrix || draft === undefined) return
  void draft.name
  void draft.budgetAmountMinor
  void draft.budgetKind
  void draft.objective
  void draft.targeting.length
  void draft.texts.length
  void schedule.startsAt
  void schedule.endsAt
  void step
  saveBuilderAutosave(localStorage, key, {
    matrixVersion: matrix.matrix_version,
    step,
    draft,
    schedule,
  })
})

// --- Stepping ---------------------------------------------------------------

function goNext(): void {
  const next = stepIds[stepIndex + 1]
  if (next) void advanceTo(next)
}

async function advanceTo(next: BuilderStepId): Promise<void> {
  const active = activeConnection()
  if (!schema || !draft || !active) return
  // The engine gates the step client-side first.
  const issues = validateStep(schema, draft, step, active.currency)
  if (issues.length > 0) return
  serverViolations = []
  submitError = undefined

  // Edit mode: the backend's dry run confirms the delta before the step
  // turns — field violations land back on the form, verbatim.
  if (editMode && campaign) {
    submitting = true
    try {
      // The builder treats budget kinds and objectives as matrix data; the
      // contract types them as the platform's union. The draft has been
      // validated against that same matrix, so the boundary cast is safe.
      const payload = draftToPatchPayload(draft, {
        currency: active.currency,
        schedule,
      }) as unknown as PatchCampaignRequest
      const result = await validateAdCampaign(apiClient, campaign.id, payload)
      if (result && result.violations.length > 0) {
        serverViolations = result.violations
        return
      }
    } catch {
      submitError = t['admin.advertising.builder.validateError']()
      return
    } finally {
      submitting = false
    }
  }
  step = next
}

function goBackTo(id: BuilderStepId): void {
  serverViolations = []
  submitError = undefined
  step = id
}

function onStepperSelect(id: string): void {
  const target = stepIds.indexOf(id as BuilderStepId)
  // Backwards jumps are always allowed; forward ones never happen from the
  // stepper — advancing is what validation is for.
  if (target >= 0 && target < stepIndex) goBackTo(id as BuilderStepId)
}

// --- Submit -----------------------------------------------------------------

const reviewIssues = $derived(
  schema && draft && connection ? validateStep(schema, draft, 'review', connection.currency) : [],
)

const budgetDelta = $derived.by(() => {
  if (!editMode || !campaign || !draft || !connection) return undefined
  const raw = draft.budgetAmountMinor.trim()
  if (!/^\d+$/.test(raw)) return undefined
  return budgetIncrease(
    campaign.campaign.budget.amount.amount_minor,
    Number(raw),
    connection.currency,
  )
})

const budgetConfirmLines = $derived.by(() => {
  if (!budgetDelta || !connection) return undefined
  return {
    previous: money(budgetDelta.previousMinor ?? 0, connection.currency),
    next: money(budgetDelta.nextMinor ?? 0, connection.currency),
    daily: money(budgetDelta.dailyDeltaMinor, connection.currency),
    monthly: money(budgetDelta.monthlyDeltaMinor, connection.currency),
  }
})

function onSubmitStep(): void {
  goNext()
}

async function submitReview(): Promise<void> {
  const active = activeConnection()
  if (!draft || !active || submitting || reviewIssues.length > 0) return

  // A budget increase above the threshold cannot pass this point without
  // the dialog — its confirm re-enters with the flag set.
  if (budgetDelta?.required && !budgetConfirmPending) {
    budgetConfirmOpen = true
    return
  }

  submitting = true
  submitError = undefined
  serverViolations = []
  pendingKey = pendingKey ?? crypto.randomUUID()

  try {
    if (editMode && campaign && editId) {
      const payload = draftToPatchPayload(draft, {
        currency: active.currency,
        schedule,
      }) as unknown as PatchCampaignRequest
      const updated = await patchAdCampaign(apiClient, campaign.id, payload, {
        revision: campaign.revision,
        idempotencyKey: pendingKey,
      })
      clearBuilderAutosave(localStorage, autosaveKeyFor() ?? '')
      pendingKey = undefined
      navigate(`/advertising/campaigns/${updated.id}`)
      return
    }

    const payload = draftToCreatePayload(draft, {
      connectionId: active.id,
      currency: active.currency,
      schedule,
    }) as unknown as CreateCampaignRequest
    const created = await createAdCampaign(apiClient, payload, pendingKey)
    // The targeting selection rides on a seeded first ad group — targeting
    // lives on ad groups in the contract, not on the campaign. A failure
    // here leaves the campaign created; the detail view shows the tree.
    const seed = seedAdGroupPayload(draft, t['admin.advertising.builder.firstAdGroupName']())
    if (seed) {
      try {
        await addAdAdGroup(apiClient, created.id, seed, {
          revision: created.revision,
          idempotencyKey: crypto.randomUUID(),
        })
      } catch {
        showToast({
          title: t['admin.advertising.builder.seedAdGroupFailed'](),
          variant: 'warning',
        })
      }
    }
    clearBuilderAutosave(localStorage, autosaveKeyFor() ?? '')
    pendingKey = undefined
    navigate(`/advertising/campaigns/${created.id}`)
  } catch (err) {
    handleSubmitError(err)
  } finally {
    budgetConfirmPending = false
    submitting = false
  }
}

function handleSubmitError(err: unknown): void {
  if (err instanceof ApiError) {
    if (err.status === 409) {
      if (!editId) {
        submitError = t['admin.advertising.builder.duplicateCreateError']()
        return
      }
      // The campaign moved under us — show the current state and stop.
      // No retry, no merge: the operator decides from what is shown.
      void reloadConflict()
      return
    }
    if (err.status === 400 && err.problem && hasViolations(err.problem)) {
      serverViolations = err.problem['violations'] as ValidationViolation[]
      return
    }
    if (err.status === 403) {
      forbidden = true
      return
    }
    if (err.status === 429) {
      submitError = t['admin.advertising.campaigns.quota']()
      return
    }
    if (err.status === 503) {
      submitError = t['admin.advertising.campaigns.platformUnavailable']()
      return
    }
  }
  submitError = t['admin.advertising.builder.submitError']()
}

function hasViolations(problem: Record<string, unknown>): boolean {
  return Array.isArray(problem['violations']) && problem['violations'].length > 0
}

async function reloadConflict(): Promise<void> {
  if (!editId) return
  try {
    conflictCurrent = await getAdCampaign(apiClient, editId)
  } catch {
    conflictCurrent = null
    submitError = t['admin.advertising.builder.submitError']()
  }
}

function discardLocalChanges(): void {
  pendingKey = undefined
  clearBuilderAutosave(localStorage, autosaveKeyFor() ?? '')
  void load()
}

// --- Derived display --------------------------------------------------------

const scheduleSummary = $derived.by(() => {
  const parts: string[] = []
  if (schedule.startsAt) parts.push(schedule.startsAt.replace('T', ' '))
  if (schedule.endsAt) parts.push(schedule.endsAt.replace('T', ' '))
  return parts.length > 0 ? parts.join(' — ') : t['admin.advertising.builder.scheduleNone']()
})

const targetingSummary = $derived(
  draft && draft.targeting.length > 0
    ? draft.targeting
        .map((dimension) => dataLabel('admin.advertising.option.', dimension))
        .join(', ')
    : t['admin.advertising.builder.targetingNone'](),
)

$effect(() => {
  void getActiveTenantId()
  void load()
})
</script>

<svelte:head>
  <title>
    {editMode ? t['admin.advertising.builder.editTitle']() : t['admin.advertising.builder.title']()}
  </title>
</svelte:head>

<Container size="md" padding="6">
  <Stack gap="6">
    <div>
      <h1>
        {editMode
          ? t['admin.advertising.builder.editHeading']()
          : t['admin.advertising.builder.heading']()}
      </h1>
      <p>{t['admin.advertising.builder.description']()}</p>
    </div>

    {#if loading}
      <Spinner label={t['admin.advertising.campaigns.loading']()} />
    {:else if !entitled}
      <EmptyState
        title={t['admin.advertising.upgradeTitle']()}
        description={t['admin.advertising.upgradeDescription']()}
      />
    {:else if forbidden || !writable}
      <EmptyState
        title={t['admin.advertising.campaigns.forbiddenTitle']()}
        description={t['admin.advertising.campaigns.forbiddenDescription']()}
      />
    {:else if error}
      <Alert variant="error">
        {error}
        <Button variant="secondary" onclick={() => void load()}>{t['common.retry']()}</Button>
      </Alert>
    {:else if !editMode && !connectionId}
      {#if selectableConnections.length === 0}
        <EmptyState
          title={t['admin.advertising.campaigns.noConnectionTitle']()}
          description={t['admin.advertising.campaigns.noConnectionDescription']()}
        >
          {#snippet action()}
            <Button variant="secondary" onclick={() => navigate('/advertising/connections')}>
              {t['admin.advertising.manageConnectionsCta']()}
            </Button>
          {/snippet}
        </EmptyState>
      {:else}
        <fieldset class="sanvi-ad-builder__picker">
          <legend>{t['admin.advertising.builder.connectionPickerLabel']()}</legend>
          {#each selectableConnections as candidate (candidate.id)}
            <div class="sanvi-ad-builder__picker-row">
              <label>
                <input
                  type="radio"
                  name="ad-connection"
                  value={candidate.id}
                  onchange={() => {
                    connectionId = candidate.id
                    void load()
                  }}
                />
                {candidate.account_name ?? candidate.external_account_id}
                · {candidate.currency} · {candidate.timezone}
              </label>
            </div>
          {/each}
        </fieldset>
      {/if}
    {:else if !connection || !matrix || !schema || draft === undefined}
      <Alert variant="error">{t['admin.advertising.builder.matrixMissing']()}</Alert>
    {:else}
      {#if conflictCurrent}
        <!-- 409: the campaign changed since it was opened. The current state
             is shown; nothing is retried or merged. -->
        <Stack gap="4">
          <Alert variant="warning">
            <p>{t['admin.advertising.builder.conflictHeading']()}</p>
            <p class="sanvi-ad-builder__conflict-state">
              {t['admin.advertising.builder.conflictState']({
                name: conflictCurrent.campaign.name,
                revision: conflictCurrent.revision,
              })}
            </p>
          </Alert>
          <Cluster gap="2">
            <Button variant="primary" onclick={() => discardLocalChanges()}>
              {t['admin.advertising.builder.conflictDiscard']()}
            </Button>
            <Button
              variant="secondary"
              onclick={() => navigate(`/advertising/campaigns/${editId}`)}
            >
              {t['admin.advertising.builder.conflictDetail']()}
            </Button>
          </Cluster>
        </Stack>
      {:else}
        {#if editMode && campaign}
          <p class="sanvi-ad-builder__meta">
            {t['admin.advertising.builder.editingMeta']({
              name: campaign.campaign.name,
              platform: platform?.display_name ?? campaign.platform,
            })}
          </p>
        {/if}

        <StepperNav
          steps={stepIds.map((id) => ({ id, label: stepLabel(id) }))}
          current={step}
          onStepSelect={onStepperSelect}
          labels={{
            complete: t['admin.advertising.builder.stepComplete'](),
            current: t['admin.advertising.builder.stepCurrent'](),
            upcoming: t['admin.advertising.builder.stepUpcoming'](),
            stepOf: (index, count) => t['admin.advertising.builder.stepOf']({ step: index, count }),
          }}
        />

        {#if submitError}
          <Alert variant="error">{submitError}</Alert>
        {/if}

        {#if step === 'creatives'}
          <!-- Creative fields land with TASK-013: this slice's contract has
               no campaign-level copy — ads and their creative text are per
               ad group, managed from the detail view. -->
          <EmptyState
            title={t['admin.advertising.builder.creativesTitle']()}
            description={t['admin.advertising.builder.creativesDescription']()}
          />
        {:else if step === 'review'}
          <Stack gap="4">
            <dl class="sanvi-ad-builder__review">
              <div>
                <dt>{t['admin.advertising.builder.reviewName']()}</dt>
                <dd>{draft.name}</dd>
              </div>
              <div>
                <dt>{t['admin.advertising.builder.reviewObjective']()}</dt>
                <dd>
                  {draft.objective
                    ? dataLabel('admin.advertising.option.', draft.objective)
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>{t['admin.advertising.builder.reviewBudget']()}</dt>
                <dd>
                  {Number.isFinite(Number(draft.budgetAmountMinor || '0'))
                    ? formatAdCurrency(Number(draft.budgetAmountMinor || '0'), connection.currency)
                    : '—'}
                  ·
                  {draft.budgetKind
                    ? dataLabel('admin.advertising.option.', draft.budgetKind)
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>{t['admin.advertising.builder.reviewSchedule']()}</dt>
                <dd>{scheduleSummary}</dd>
              </div>
              <div>
                <dt>{t['admin.advertising.builder.reviewTargeting']()}</dt>
                <dd>
                  {editMode
                    ? t['admin.advertising.builder.targetingEditNote']()
                    : targetingSummary}
                </dd>
              </div>
              <div>
                <dt>{t['admin.advertising.builder.reviewConnection']()}</dt>
                <dd>
                  {connection.account_name ?? connection.external_account_id} ·
                  {platform?.display_name ?? connection.platform} · {connection.currency} ·
                  {connection.timezone}
                </dd>
              </div>
            </dl>

            {#if serverViolations.length > 0}
              <Alert variant="error">
                <ul class="sanvi-ad-builder__violations">
                  {#each serverViolations as violation (violation.field_path + violation.code)}
                    <li>{violation.message}</li>
                  {/each}
                </ul>
              </Alert>
            {/if}

            {#if reviewIssues.length > 0}
              <Alert variant="error">{t['admin.advertising.builder.reviewIssues']()}</Alert>
            {/if}
          </Stack>
        {:else if stepGroups[step]}
          {#if editMode && step === 'targeting'}
            <Stack gap="4">
              <Alert variant="info">
                {t['admin.advertising.builder.targetingEditNote']()}
              </Alert>
              <Button variant="primary" onclick={goNext}>
                {t['admin.advertising.builder.continue']()}
              </Button>
            </Stack>
          {:else}
            <CapabilityForm
              matrix={matrix}
              cacheKey={platform?.key}
              currency={connection.currency}
              bind:draft
              visibleGroups={stepGroups[step]}
              validateScope="visible"
              submitVisible
              optionLabels={optionLabelsFor()}
              serverViolations={serverViolations}
              labels={{
                nameLabel: t['admin.advertising.builder.nameLabel'](),
                objectiveLabel: t['admin.advertising.builder.objectiveLabel'](),
                objectivePlaceholder: t['admin.advertising.builder.objectivePlaceholder'](),
                budgetKindLabel: t['admin.advertising.builder.budgetKindLabel'](),
                budgetKindPlaceholder: t['admin.advertising.builder.budgetKindPlaceholder'](),
                budgetAmountLabel: t['admin.advertising.builder.budgetAmountLabel']({
                  currency: connection.currency,
                }),
                targetingLabel: t['admin.advertising.builder.targetingLabel'](),
                requiredError: t['admin.advertising.builder.requiredError'](),
                integerError: t['admin.advertising.builder.integerError'](),
                unavailableOptionError: t['admin.advertising.builder.unavailableOptionError'](),
                submitLabel: t['admin.advertising.builder.continue'](),
              }}
              formatCounter={(current, limit) => t['admin.advertising.builder.counter']({ current, limit })}
              formatMinimumHint={(minimum) =>
                t['admin.advertising.builder.minimumHint']({
                  minimum: formatAdCurrency(minimum, connection.currency),
                })}
              formatBelowMinimumError={(minimum) =>
                t['admin.advertising.builder.belowMinimum']({
                  minimum: formatAdCurrency(minimum, connection.currency),
                })}
              formatTooLongError={(limit, current) =>
                t['admin.advertising.builder.tooLong']({ limit, current })}
              onSubmit={onSubmitStep}
            />

            {#if step === 'budget'}
              <fieldset class="sanvi-ad-builder__schedule">
                <legend>{t['admin.advertising.builder.scheduleLabel']()}</legend>
                <p class="sanvi-ad-builder__schedule-hint">
                  {t['admin.advertising.builder.scheduleHint']({
                    granularity: humanizeOptionValue(matrix.schedule_granularity),
                  })}
                </p>
                <p class="sanvi-ad-builder__schedule-hint">
                  {t['admin.advertising.builder.scheduleTimezoneHint']()}
                </p>
                <label class="sanvi-ad-builder__schedule-field">
                  <span>{t['admin.advertising.builder.scheduleStart']()}</span>
                  <input
                    type="datetime-local"
                    value={formatDatetimeLocal(schedule.startsAt)}
                    onchange={(event) => {
                      schedule = { ...schedule, startsAt: event.currentTarget.value || null }
                    }}
                  />
                </label>
                <label class="sanvi-ad-builder__schedule-field">
                  <span>{t['admin.advertising.builder.scheduleEnd']()}</span>
                  <input
                    type="datetime-local"
                    value={formatDatetimeLocal(schedule.endsAt)}
                    onchange={(event) => {
                      schedule = { ...schedule, endsAt: event.currentTarget.value || null }
                    }}
                  />
                </label>
              </fieldset>
            {/if}
          {/if}
        {/if}

        <Cluster gap="2" align="center">
          {#if stepIndex > 0}
            <Button variant="ghost" onclick={() => goBackTo(stepIds[stepIndex - 1] ?? 'basics')}>
              {t['admin.advertising.builder.back']()}
            </Button>
          {/if}
          {#if step === 'review'}
            <Button variant="primary" loading={submitting} onclick={() => void submitReview()}>
              {editMode
                ? t['admin.advertising.builder.saveChanges']()
                : t['admin.advertising.builder.createCampaign']()}
            </Button>
          {:else if step === 'creatives'}
            <!-- No form on this step — the Continue lives outside it. -->
            <Button variant="primary" onclick={goNext}>
              {t['admin.advertising.builder.continue']()}
            </Button>
          {/if}
          <Button
            variant="secondary"
            onclick={() =>
              navigate(editMode && editId ? `/advertising/campaigns/${editId}` : '/advertising/campaigns')}
          >
            {t['common.cancel']()}
          </Button>
        </Cluster>
      {/if}
    {/if}
  </Stack>
</Container>

<Dialog
  bind:open={budgetConfirmOpen}
  titleText={t['admin.advertising.builder.budgetConfirmTitle']()}
>
  {#snippet children()}
    <Stack gap="4">
      <p>
        {t['admin.advertising.builder.budgetConfirmLead']({
          ratio: Math.round((BUDGET_CONFIRM_INCREASE_RATIO - 1) * 100),
        })}
      </p>
      {#if budgetConfirmLines}
        <dl class="sanvi-ad-builder__review">
          <div>
            <dt>{t['admin.advertising.builder.budgetPrevious']()}</dt>
            <dd>{budgetConfirmLines.previous}</dd>
          </div>
          <div>
            <dt>{t['admin.advertising.builder.budgetNext']()}</dt>
            <dd>{budgetConfirmLines.next}</dd>
          </div>
          <div>
            <dt>{t['admin.advertising.builder.budgetDailyDelta']()}</dt>
            <dd>+{budgetConfirmLines.daily}</dd>
          </div>
          <div>
            <dt>{t['admin.advertising.builder.budgetMonthlyDelta']()}</dt>
            <dd>+{budgetConfirmLines.monthly}</dd>
          </div>
        </dl>
      {/if}
      <p>{t['admin.advertising.builder.budgetConfirmNote']()}</p>
    </Stack>
  {/snippet}
  {#snippet footer()}
    <Button
      variant="ghost"
      onclick={() => {
        budgetConfirmOpen = false
      }}
    >
      {t['common.cancel']()}
    </Button>
    <Button
      variant="primary"
      onclick={() => {
        budgetConfirmPending = true
        budgetConfirmOpen = false
        void submitReview()
      }}
    >
      {t['admin.advertising.builder.budgetConfirmAccept']()}
    </Button>
  {/snippet}
</Dialog>

<style>
  .sanvi-ad-builder__meta {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-ad-builder__picker {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-3);
    padding: 0;
    border: none;
  }

  .sanvi-ad-builder__picker-row label {
    display: inline-flex;
    align-items: center;
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-ad-builder__review {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-3);
    margin: 0;
  }

  .sanvi-ad-builder__review dt {
    font-size: var(--sanvi-font-size-sm);
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-primary);
  }

  .sanvi-ad-builder__review dd {
    margin: 0;
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-ad-builder__violations {
    margin: 0;
    padding-inline-start: var(--sanvi-spacing-5);
  }

  .sanvi-ad-builder__conflict-state {
    font-weight: var(--sanvi-font-weight-medium);
  }

  .sanvi-ad-builder__schedule {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-3);
    padding: 0;
    border: none;
  }

  .sanvi-ad-builder__schedule-hint {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-ad-builder__schedule-field {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-1);
    max-width: 40ch;
  }
</style>
