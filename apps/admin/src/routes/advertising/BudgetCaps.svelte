<script lang="ts">
import type {
  BudgetPeriod,
  ConnectionView,
  DryRunEvaluationResult,
  SpendStatusItem,
} from '@sanvi/api-client'
import {
  ApiError,
  getAdMetricsFreshness,
  getAdSpendStatus,
  listAdCampaigns,
  listAdConnections,
  putAdBudgetCap,
  putAdCampaignBudgetCap,
} from '@sanvi/api-client'
import { can } from '@sanvi/auth'
import { fmt, t } from '@sanvi/i18n'
import { navigate } from '@sanvi/spa-router'
import { getActiveTenantId, hasFeature } from '@sanvi/tenant'
import {
  type AdHealthFigure,
  Alert,
  Button,
  CapProgress,
  ConsequenceDialog,
  type ConsequenceFigure,
  Container,
  EmptyState,
  Field,
  formatAdCurrency,
  humanizeOptionValue,
  HealthBanner,
  Input,
  NO_VALUE,
  Select,
  Spinner,
  Stack,
  showToast,
  UpgradePrompt,
} from '@sanvi/ui'
import {
  capDeltaRows,
  capStatusFor,
  convertRunRateToDryRunBasis,
  freshnessFacts,
  isCapAmountValid,
  isCapRaise,
  projectedBreachDate,
  scopeCampaignId,
  thresholdActionFor,
} from '../../lib/advertising/budget'
import { apiClient } from '../../lib/api'
import {
  BUDGET_PERIOD_DAILY,
  BUDGET_PERIOD_MONTHLY,
  BUDGET_PERIODS,
} from '../../lib/budget-periods'

/**
 * Budget-cap configuration (phase 10, TASK-017 / slice 10.8).
 *
 * The screen's obligation: a cap holds, and auto-pause behaves exactly as
 * this screen said it would. Three structural rules carry that:
 *
 * 1. **Every figure carries its freshness.** Spend, projection, and the
 *    projected breach date all render with the backend's `data_freshness`
 *    sentence; with stale ingestion the figures read "stale", never plain.
 * 2. **Second line, stated permanently.** The disclosure that these caps
 *    supplement the platforms' own controls and depend on Sanvi's
 *    ingestion is a permanent paragraph — not a tooltip, not an accordion.
 * 3. **Nothing that moves money saves silently.** Enabling auto-pause
 *    requires a typed confirmation whose copy states the pause figure, the
 *    affected campaigns, and that there is no auto-resume; raising a cap
 *    shows the daily and projected monthly delta first; lowering one below
 *    current spend warns (and the backend's 409 forces the same round-trip
 *    even if the client check were wrong).
 *
 * The live preview interpolates the projected breach date from the
 * backend's own spend-to-date and run-rate figures (see
 * `lib/advertising/budget.ts`) so it can follow typing; the authoritative
 * evaluation is always the backend's on save. When the tenant spends in
 * several currencies and the chosen cap currency has no converted basis in
 * `spend-status` yet, the preview instead evaluates the proposed
 * currency/basis with the backend's dry-run — it never relabels one
 * currency's figures as another's.
 */

let loading = $state(true)
let entitled = $state(true)
let guardrailsEnabled = $state(true)
let error = $state<string | undefined>(undefined)

let spendItems = $state<SpendStatusItem[]>([])
let campaigns = $state<{ id: string; name: string; currency: string; connectionId: string }[]>([])
let connections = $state<ConnectionView[]>([])
// The tenant's calendar timezone for the breach preview (see `load`).
let tenantTimezone = $state<string | undefined>(undefined)
// connection_id → platform for the connections whose ingestion has
// stalled (TASK-018): stale figure labels name the platform behind them.
let stalledPlatformNames = $state<Map<string, string | null>>(new Map())

// --- The cap form -----------------------------------------------------------
// The selects bind plain strings, so the two switches are string-backed.
let scope = $state<'tenant' | 'campaign'>('tenant')
let campaignId = $state('')
let periodChoice = $state<BudgetPeriod>(BUDGET_PERIOD_MONTHLY)
let amountMinor = $state('')
let autoPauseChoice = $state('false')
let capCurrency = $state('')
let fxRateDate = $state('')
let saving = $state(false)
let formError = $state<string | undefined>(undefined)

const period = $derived(periodChoice)
const autoPause = $derived(autoPauseChoice === 'true')
// The backend keeps `auto_resume_on_rollover` for compatibility only and
// never resumes a paused campaign: a paused campaign stays paused until an
// operator brings it back. The form therefore offers no resume control and
// never sends the flag — offering it would promise a lifecycle the server
// does not run.

// --- Confirmation state -----------------------------------------------------
let confirmOpen = $state(false)
let confirmSubmitting = $state(false)
let confirmError = $state<string | undefined>(undefined)
let belowSpendOpen = $state(false)

let loadSeq = 0
let loadedTenantId: string | undefined

async function load(): Promise<void> {
  const seq = ++loadSeq
  const tenantId = getActiveTenantId()
  if (loadedTenantId !== undefined && loadedTenantId !== tenantId) {
    // Tenant switched while the route stayed mounted: the draft (amount,
    // currency, scope, period, auto-pause) belongs to the previous tenant
    // and must not leak into the new one — a stuck JPY basis with a typed
    // amount could otherwise save one tenant's cap against another without
    // an FX basis. Post-save reloads keep the tenant, so they keep the draft.
    resetForm()
  }
  loadedTenantId = tenantId
  loading = true
  error = undefined
  entitled = true
  formError = undefined
  spendItems = []
  campaigns = []
  connections = []
  tenantTimezone = undefined
  stalledPlatformNames = new Map()
  guardrailsEnabled = hasFeature('advertising.budget_guardrails')

  if (!guardrailsEnabled) {
    loading = false
    return
  }

  const [statusResult, campaignsResult, connectionsResult, freshnessResult] =
    await Promise.allSettled([
      getAdSpendStatus(apiClient),
      listAdCampaigns(apiClient),
      listAdConnections(apiClient),
      getAdMetricsFreshness(apiClient),
    ])
  if (seq !== loadSeq) return

  if (statusResult.status === 'rejected') {
    const err = statusResult.reason
    if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
      entitled = false
    } else {
      error = t['admin.advertising.budget.loadError']()
    }
  }
  spendItems = statusResult.status === 'fulfilled' ? (statusResult.value?.items ?? []) : []
  // Which platforms' ingestion has stalled (TASK-018 degraded mode): the
  // stale labels on cap figures name the platform behind them. Optional —
  // a freshness failure keeps the labels working, just unnamed.
  stalledPlatformNames = (() => {
    if (freshnessResult.status !== 'fulfilled') return new Map<string, string | null>()
    const stalled = (freshnessResult.value?.connections ?? []).filter((entry) => entry.stalled)
    return new Map(stalled.map((entry) => [entry.connection_id, entry.platform]))
  })()
  // The tenant's own calendar timezone, carried by the spend-status report
  // itself: the same clock the backend's spend windows, dedupe keys, and
  // run-rate projections use (TASK-017), so the live preview cannot disagree
  // with enforcement — and no locale-settings permission is needed to read
  // it. Missing/unreadable settings fall back to the helper's UTC behaviour,
  // matching the backend's unset-settings default.
  tenantTimezone = statusResult.status === 'fulfilled' ? statusResult.value?.timezone : undefined
  connections =
    connectionsResult.status === 'fulfilled' ? (connectionsResult.value?.connections ?? []) : []
  campaigns =
    campaignsResult.status === 'fulfilled'
      ? (campaignsResult.value?.campaigns ?? []).map((view) => {
          const connection = connections.find((entry) => entry.id === view.connection_id)
          return {
            id: view.id,
            name: view.campaign.name,
            currency: connection?.currency ?? view.campaign.budget.amount.currency,
            connectionId: view.connection_id,
          }
        })
      : []

  if (connectionsResult.status === 'rejected' || campaignsResult.status === 'rejected') {
    // The status report alone still renders the caps in place; the form
    // needs the campaign list, so only it degrades.
    if (campaignsResult.status === 'rejected') {
      formError = t['admin.advertising.budget.formUnavailable']()
    }
  }

  // A single account currency is the only possible basis — pick it. With
  // several, the choice stays unselected: the tenant must make the FX
  // basis explicit, the form blocks the save until they do.
  const choices = capCurrencyChoices()
  if (capCurrency === '' && choices.length === 1) {
    capCurrency = choices[0]!.value
  }
  loading = false
}

const writable = $derived(can('advertising.budget.manage', getActiveTenantId()))

// --- Scope/currency choices -------------------------------------------------

const capCurrencyChoices = (): { value: string; label: string }[] => {
  const currencies = [...new Set(connections.map((connection) => connection.currency))].sort()
  return currencies.map((currency) => ({ value: currency, label: currency }))
}

const crossCurrency = $derived(scope === 'tenant' && capCurrencyChoices().length > 1)

const activeCampaign = $derived(campaigns.find((campaign) => campaign.id === campaignId))

const formCurrency = $derived(scope === 'campaign' ? (activeCampaign?.currency ?? '') : capCurrency)

/** The spend-status item this form's scope+period resolves to. */
const formItem = $derived.by(() => {
  const campaign = scope === 'campaign' ? campaignId : undefined
  return spendItems.find(
    (item) => item.period === period && (scopeCampaignId(item.scope) ?? undefined) === campaign,
  )
})

const formAmountValid = $derived(isCapAmountValid(amountMinor))

// --- Live preview (backend figures + labelled interpolation) ----------------
//
// Single-basis previews interpolate locally from the spend-status item
// whose currency already matches the form. A cross-currency tenant preview
// has no converted basis: spend-status reports the existing cap's
// currency — or the first connection's currency with unconvertible spend
// excluded when no cap exists — so relabelling those amounts with the
// newly selected currency would print one currency's figures as another's.
// Those previews evaluate the proposed currency/basis with the backend's
// dry-run instead (see the effect below). The dry-run answers current
// spend in the proposed currency but carries no projected spend, and its
// `would_breach_*` flags compare current spend against the cap only —
// rendering them as the verdict would call a 60,000 cap with 40,000 spent
// "safe" while the 62,000 run rate breaches it. So the preview converts
// the spend-status run rate at the dry-run's own factor
// (`convertRunRateToDryRunBasis`) and interpolates the breach from the
// converted pair: all three figures — current, projected, breach date —
// stay in the proposed currency and stay labelled projected, with the
// FX-basis note inline. (A `projected_spend` field on the backend's
// dry-run result would retire the client-side conversion; the
// authoritative evaluation is the backend's on save either way.)

interface DryRunPreview {
  spendMinor: number
  currency: string
}

let dryRun = $state<DryRunPreview | undefined>(undefined)
let dryRunPending = $state(false)
let dryRunFailed = $state(false)
let dryRunSeq = 0

/** True while the form asks for a currency the spend-status item cannot supply. */
const needsDryRun = $derived(
  Boolean(formAmountValid && formCurrency && crossCurrency && scope === 'tenant'),
)

$effect(() => {
  const wantDryRun = needsDryRun
  const snapshot = {
    amount: amountMinor.trim(),
    currency: formCurrency,
    periodChoice: period,
    fxRateDate,
    autoPause,
    crossCurrency,
  }
  if (!wantDryRun || !snapshot.amount || !snapshot.currency) {
    dryRunSeq += 1
    dryRun = undefined
    dryRunPending = false
    dryRunFailed = false
    return
  }
  const seq = ++dryRunSeq
  dryRunPending = true
  dryRunFailed = false
  const timer = setTimeout(() => {
    void (async () => {
      const body = {
        period: snapshot.periodChoice,
        amount: { amount_minor: Number(snapshot.amount), currency: snapshot.currency },
        auto_pause: snapshot.autoPause,
        dry_run: true as const,
        declared_fx_basis: `explicit:${snapshot.currency}`,
        ...(snapshot.fxRateDate ? { fx_rate_date: snapshot.fxRateDate } : {}),
      }
      try {
        const result = await putAdBudgetCap(apiClient, body)
        if (seq !== dryRunSeq) return
        if (isDryRunResult(result)) {
          dryRun = {
            spendMinor: result.current_spend.amount_minor,
            currency: result.current_spend.currency,
          }
          dryRunFailed = false
        } else {
          dryRun = undefined
          dryRunFailed = true
        }
      } catch {
        if (seq !== dryRunSeq) return
        dryRun = undefined
        dryRunFailed = true
      } finally {
        if (seq === dryRunSeq) dryRunPending = false
      }
    })()
  }, 250)
  return () => clearTimeout(timer)
})

function isDryRunResult(
  value: unknown,
): value is DryRunEvaluationResult & { current_spend: { amount_minor: number; currency: string } } {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  const current = record['current_spend']
  if (typeof current !== 'object' || current === null) return false
  const spend = current as Record<string, unknown>
  return (
    typeof spend['amount_minor'] === 'number' && typeof record['would_breach_100'] === 'boolean'
  )
}

const preview = $derived.by(() => {
  if (!formAmountValid || !formCurrency) return undefined
  const capMinor = Number(amountMinor.trim())
  if (needsDryRun) {
    if (dryRunPending || dryRunFailed || !dryRun || !formItem) return undefined
    // No convertible run rate (period start with nothing spent yet, or a
    // near-flat rate whose rounding the factor would amplify): fall back
    // to the unavailable note rather than an unconverted figure.
    const converted = convertRunRateToDryRunBasis(
      formItem.spend_to_date.amount_minor,
      formItem.projected_spend.amount_minor,
      dryRun.spendMinor,
    )
    if (!converted) return undefined
    const breach = projectedBreachDate(
      period,
      capMinor,
      converted.spendMinor,
      converted.projectedMinor,
      new Date(),
      tenantTimezone,
    )
    return {
      usesDryRun: true as const,
      currency: dryRun.currency,
      spendText: formatAdCurrency(converted.spendMinor, dryRun.currency),
      projectedText: formatAdCurrency(converted.projectedMinor, dryRun.currency),
      breachDate: breach?.date,
      facts: freshnessFacts(formItem),
    }
  }
  const item = formItem
  const spendMinor = item?.spend_to_date.amount_minor ?? 0
  const projectedMinor = item?.projected_spend.amount_minor ?? 0
  const breach = projectedBreachDate(
    period,
    capMinor,
    spendMinor,
    projectedMinor,
    new Date(),
    tenantTimezone,
  )
  const facts = item ? freshnessFacts(item) : undefined
  return {
    usesDryRun: false as const,
    spendText: formatAdCurrency(spendMinor, formCurrency),
    projectedText: formatAdCurrency(projectedMinor, formCurrency),
    breachDate: breach?.date,
    facts,
  }
})

/** The platform(s) behind a stale figure (TASK-018): a campaign-scoped cap
    names its own platform; the tenant cap names every stalled one. */
function stalePlatformNames(item: SpendStatusItem): string[] {
  // This screen never loads the platform catalog, so the display name
  // falls to the shared humanizer: `google_ads` → "Google Ads".
  const display = (key: string): string => humanizeOptionValue(key)
  const campaignId = scopeCampaignId(item.scope)
  if (campaignId) {
    const connectionId = campaigns.find((entry) => entry.id === campaignId)?.connectionId
    const platform = connectionId ? (stalledPlatformNames.get(connectionId) ?? null) : null
    return platform ? [display(platform)] : []
  }
  return [...stalledPlatformNames.values()]
    .filter((entry): entry is string => entry !== null)
    .map(display)
}

function freshnessSentence(
  facts: ReturnType<typeof freshnessFacts> | undefined,
  item?: SpendStatusItem,
): string {
  if (!facts) return t['admin.advertising.budget.freshness.noData']()
  if (facts.stale) {
    const platformList = item ? stalePlatformNames(item) : []
    if (platformList.length > 0) {
      const platform = platformList.length === 1 ? platformList[0]! : fmt.list(platformList)
      return facts.lastSyncedAt
        ? t['admin.advertising.budget.freshness.stalePlatform']({
            platform,
            time: fmt.datetime(facts.lastSyncedAt),
          })
        : t['admin.advertising.budget.freshness.stalePlatformNoTime']({ platform })
    }
    return facts.lastSyncedAt
      ? t['admin.advertising.budget.freshness.stale']({ time: fmt.datetime(facts.lastSyncedAt) })
      : t['admin.advertising.budget.freshness.staleNoTime']()
  }
  if (facts.lastSyncedAt) {
    // A normal monthly status carries a provisional tail (recent days still
    // updating, `is_settled: false`) — "last synced" alone hides that the
    // figures may still move, so unsettled or provisional figures say so.
    if (!facts.settled || facts.provisionalMinor > 0) {
      return t['admin.advertising.budget.freshness.currentProvisional']({
        time: fmt.datetime(facts.lastSyncedAt),
      })
    }
    return t['admin.advertising.budget.freshness.current']({
      time: fmt.datetime(facts.lastSyncedAt),
    })
  }
  return t['admin.advertising.budget.freshness.noData']()
}

// --- Existing caps ----------------------------------------------------------

function existingCapFor(campaign: string | undefined, forPeriod: BudgetPeriod) {
  return (
    spendItems.find(
      (item) =>
        item.period === forPeriod && (scopeCampaignId(item.scope) ?? undefined) === campaign,
    )?.cap ?? undefined
  )
}

function scopeHeading(item: SpendStatusItem): string {
  const campaign = scopeCampaignId(item.scope)
  if (!campaign) return t['admin.advertising.budget.scope.tenant']()
  return campaigns.find((entry) => entry.id === campaign)?.name ?? campaign
}

function thresholdActionLabel(action: string): string {
  return action === 'pause'
    ? t['admin.advertising.budget.actions.pause']()
    : t['admin.advertising.budget.actions.notify']()
}

/** Caps in place, tenant scope first, then by campaign name. */
const cappedItems = $derived(
  spendItems
    .filter((item) => item.cap !== null && item.cap !== undefined)
    .sort((left, right) => {
      if (left.scope === 'tenant') return -1
      if (right.scope === 'tenant') return 1
      return scopeHeading(left).localeCompare(scopeHeading(right))
    }),
)

// --- Threshold banners ------------------------------------------------------

const bannerState = $derived.by(() => {
  let hit: SpendStatusItem | undefined
  let warning: SpendStatusItem | undefined
  for (const item of cappedItems) {
    const status = capStatusFor(item.percentage)
    if (status === 'hit' && !hit) hit = item
    if (status === 'warning' && !warning) warning = item
  }
  return { hit, warning }
})

const bannerFigures = (item: SpendStatusItem): AdHealthFigure[] => {
  const currency = item.cap?.amount.currency ?? item.spend_to_date.currency
  return [
    {
      key: item.scope,
      value: `${formatAdCurrency(item.spend_to_date.amount_minor, currency)} / ${formatAdCurrency(item.cap?.amount.amount_minor ?? 0, currency)}`,
      label: scopeHeading(item),
      description: freshnessSentence(freshnessFacts(item), item),
    },
  ]
}

// --- Save + confirmation flows ---------------------------------------------

function deltaFigures(): ConsequenceFigure[] {
  const previous = existingCapFor(scope === 'campaign' ? campaignId : undefined, period)
  if (!previous) return []
  // A currency change has no honest minor-unit delta: 100,000 JPY → 1,000 USD
  // is neither a raise of 99,000 nor anything else until converted, and this
  // client holds no conversion basis. Suppress the delta rows (the dialog's
  // consequence copy still names the new figure) rather than print one
  // currency's arithmetic labelled in another's.
  if (previous.amount.currency !== formCurrency) return []
  const rows = capDeltaRows(period, previous.amount.amount_minor, Number(amountMinor.trim()))
  if (!rows) return []
  return [
    { key: 'primary', label: t[rows.primaryLabelKey](), value: formatDelta(rows.primaryMinor) },
    { key: 'derived', label: t[rows.derivedLabelKey](), value: formatDelta(rows.derivedMinor) },
  ]
}

function formatDelta(minor: number): string {
  const sign = minor > 0 ? '+' : minor < 0 ? '−' : ''
  return sign + formatAdCurrency(Math.abs(minor), formCurrency)
}

const confirmConsequence = $derived.by(() => {
  const scopeLabel =
    scope === 'campaign'
      ? (activeCampaign?.name ?? t['admin.advertising.budget.scope.campaignFallback']())
      : t['admin.advertising.budget.scope.tenant']()
  const figure = formatAdCurrency(Number(amountMinor.trim() || '0'), formCurrency)
  if (!autoPause) {
    return t['admin.advertising.budget.confirm.raiseConsequence']({
      figure,
      scope: scopeLabel,
      period: periodLabelOf(period),
    })
  }
  return t['admin.advertising.budget.confirm.pauseConsequence']({ figure, scope: scopeLabel })
})

const confirmPhrase = $derived(
  autoPause ? formatAdCurrency(Number(amountMinor.trim() || '0'), formCurrency) : undefined,
)

async function submit(): Promise<void> {
  if (!writable || !formAmountValid || !formCurrency) return
  if (crossCurrency && !capCurrency) return
  formError = undefined

  const previous = existingCapFor(scope === 'campaign' ? campaignId : undefined, period)
  // Minor units are comparable only within one currency (see `isCapRaise`):
  // a currency change always confirms, exactly like a raise.
  const raising = isCapRaise(
    previous
      ? { amountMinor: previous.amount.amount_minor, currency: previous.amount.currency }
      : undefined,
    Number(amountMinor.trim()),
    formCurrency,
  )
  const enablingPause = autoPause && !(previous?.auto_pause ?? false)

  if (raising || enablingPause) {
    confirmError = undefined
    confirmOpen = true
    return
  }
  await doSave({ confirmBelowCurrentSpend: false })
}

async function onConfirm(): Promise<void> {
  confirmSubmitting = true
  confirmError = undefined
  try {
    await doSave({ confirmBelowCurrentSpend: false })
    confirmOpen = false
  } catch {
    // doSave reports to the form; keep the dialog open for a retry.
    confirmError = t['admin.advertising.budget.saveError']()
  } finally {
    confirmSubmitting = false
  }
}

async function onBelowSpendConfirm(): Promise<void> {
  belowSpendOpen = false
  await doSave({ confirmBelowCurrentSpend: true })
}

async function doSave(options: { confirmBelowCurrentSpend: boolean }): Promise<void> {
  if (!writable || !formAmountValid || !formCurrency) return
  saving = true
  formError = undefined
  // The `If-Match` version is derived from the *currently selected* target
  // on every save — never carried from `editCap`: scope, campaign, and
  // period stay editable after an edit, so a stored version could name
  // another cap (or none). A target switch mid-draft simply re-binds the
  // guard to the newly selected cap.
  const saveTarget = existingCapFor(scope === 'campaign' ? campaignId : undefined, period)
  const saveVersion = saveTarget?.version
  const body = {
    period,
    amount: { amount_minor: Number(amountMinor.trim()), currency: formCurrency },
    auto_pause: autoPause,
    // No `auto_resume_on_rollover`: the backend never resumes a paused
    // campaign (the field is compatibility-only), so the form must not let
    // an operator save — or believe — otherwise.
    // A cross-currency cap is only saveable with the tenant's explicit FX
    // basis: the form blocks the save without one (acceptance criterion),
    // and the declaration names the chosen basis currency explicitly — the
    // UI never lets the backend assume a conversion.
    ...(crossCurrency
      ? {
          declared_fx_basis: `explicit:${formCurrency}`,
          ...(fxRateDate ? { fx_rate_date: fxRateDate } : {}),
        }
      : {}),
    ...(options.confirmBelowCurrentSpend ? { confirm_below_current_spend: true } : {}),
  }
  try {
    if (scope === 'campaign' && campaignId) {
      await putAdCampaignBudgetCap(apiClient, campaignId, body, {
        ...(saveVersion !== undefined ? { expectedVersion: saveVersion } : {}),
      })
    } else {
      await putAdBudgetCap(apiClient, body, {
        ...(saveVersion !== undefined ? { expectedVersion: saveVersion } : {}),
      })
    }
    showToast({
      title: t['admin.advertising.budget.savedToast'](),
      variant: 'success',
    })
    await load()
  } catch (err) {
    // The two 409s are distinguished by the problem's machine-readable
    // `type`, never by `detail` text: the client sends `Accept-Language`,
    // so a localized (or reworded) detail string cannot be routed on — a
    // below-spend conflict misread as a stale version would leave the
    // operator's typed figure silently overwritten and the save
    // unreachable. The type is the backend's contract
    // (`advertising/cap-below-current-spend`, see api-client).
    if (
      err instanceof ApiError &&
      err.status === 409 &&
      err.type === 'advertising/cap-below-current-spend'
    ) {
      // The backend's guard: the new cap is below the period's spend so
      // far. The warning names what that can do — pause campaigns at once
      // — and the retry carries the explicit confirmation flag.
      belowSpendOpen = true
      return
    }
    if (err instanceof ApiError && err.status === 409) {
      // A stale `If-Match`: someone saved this cap after the draft was
      // read. Reload, then repopulate the draft from the winner so the
      // next save carries the current version and current figures — the
      // stale draft must not retry version-less into a blind overwrite.
      // The operator is *told* their draft was replaced: a silently
      // rewritten amount field is how a retyped "200,000" becomes a
      // committed "120,000".
      await load()
      const refreshed = existingCapFor(scope === 'campaign' ? campaignId : undefined, period)
      if (refreshed) {
        amountMinor = String(refreshed.amount.amount_minor)
        autoPauseChoice = refreshed.auto_pause ? 'true' : 'false'
        if (scope === 'tenant') {
          capCurrency = refreshed.amount.currency
          fxRateDate = refreshed.fx_rate_date ?? ''
        }
      } else {
        resetForm()
      }
      formError = t['admin.advertising.budget.conflictRepopulated']()
      throw err
    }
    if (err instanceof ApiError && err.status === 403) {
      formError = t['admin.advertising.budget.forbidden']()
    } else {
      formError = t['admin.advertising.budget.saveError']()
    }
    throw err
  } finally {
    saving = false
  }
}

function editCap(item: SpendStatusItem): void {
  const campaign = scopeCampaignId(item.scope)
  scope = campaign ? 'campaign' : 'tenant'
  campaignId = campaign ?? ''
  periodChoice = item.period
  capCurrency = item.cap?.amount.currency ?? item.cap?.effective_currency ?? ''
  amountMinor = String(item.cap?.amount.amount_minor ?? '')
  autoPauseChoice = item.cap?.auto_pause ? 'true' : 'false'
  formError = undefined
}

function resetForm(): void {
  scope = 'tenant'
  campaignId = ''
  periodChoice = BUDGET_PERIOD_MONTHLY
  amountMinor = ''
  autoPauseChoice = 'false'
  capCurrency = ''
  fxRateDate = ''
  formError = undefined
  // Pending confirmations and the FX dry-run belong to the discarded draft
  // too — a confirmation saved after the switch would carry the old scope.
  confirmOpen = false
  confirmSubmitting = false
  confirmError = undefined
  belowSpendOpen = false
  dryRunSeq += 1
  dryRun = undefined
  dryRunPending = false
  dryRunFailed = false
}

function periodLabelOf(value: BudgetPeriod): string {
  return value === BUDGET_PERIOD_DAILY
    ? t['admin.advertising.budget.period.daily']()
    : t['admin.advertising.budget.period.monthly']()
}

$effect(() => {
  void getActiveTenantId()
  void load()
})
</script>

<svelte:head>
  <title>{t['admin.advertising.budget.title']()}</title>
</svelte:head>

<Container size="lg" padding="6">
  <Stack gap="6">
    <div>
      <h1>{t['admin.advertising.budget.title']()}</h1>
      <p>{t['admin.advertising.budget.description']()}</p>
      <Button variant="secondary" onclick={() => navigate('/advertising/budget/alerts')}>
        {t['admin.advertising.budget.alertHistoryCta']()}
      </Button>
    </div>

    {#if loading}
      <Spinner label={t['admin.advertising.budget.loading']()} />
    {:else if !guardrailsEnabled}
      <!-- Rollback state: names the reason, and says what happens to caps
           already in place — a guardrail that silently stops guarding is
           the worst outcome available on this screen. -->
      <EmptyState
        title={t['admin.advertising.budget.flagOffTitle']()}
        description={t['admin.advertising.budget.flagOffDescription']()}
      >
        {#snippet action()}
          <p class="budget__flag-off-note">
            {t['admin.advertising.budget.flagOffNote']()}
          </p>
        {/snippet}
      </EmptyState>
    {:else if !entitled}
      <UpgradePrompt
        title={t['admin.advertising.upgradeTitle']()}
        description={t['admin.advertising.upgradeDescription']()}
        upgradeHref="/billing"
      />
    {:else}
      {#if error}
        <Alert variant="error">
          {error}
          <Button variant="secondary" onclick={() => void load()}>{t['common.retry']()}</Button>
        </Alert>
      {/if}

      <!-- Second-line disclosure: permanent, never a tooltip or accordion. -->
      <p class="budget__disclosure">{t['admin.advertising.budget.secondLine']()}</p>

      {#if bannerState.hit}
        <HealthBanner
          title={t['admin.advertising.budget.banner.hitTitle']()}
          figures={bannerFigures(bannerState.hit)}
          tone="error"
        />
      {:else if bannerState.warning}
        <HealthBanner
          title={t['admin.advertising.budget.banner.warningTitle']()}
          figures={bannerFigures(bannerState.warning)}
          tone="warning"
        />
      {/if}

      {#if cappedItems.length === 0}
        <EmptyState
          title={t['admin.advertising.budget.emptyTitle']()}
          description={t['admin.advertising.budget.emptyDescription']()}
        />
      {:else}
        <section aria-labelledby="budget-caps-heading">
          <Stack gap="4">
            <h2 id="budget-caps-heading">{t['admin.advertising.budget.capsHeading']()}</h2>
            <div class="budget__caps">
              {#each cappedItems as item (item.scope + ':' + item.period)}
                {@const cap = item.cap!}
                {@const currency = cap.amount.currency}
                {@const facts = freshnessFacts(item)}
                {@const status = capStatusFor(item.percentage)}
                {@const reachedAction = thresholdActionFor(item.percentage, item.actions_configured)}
                <div class="budget__cap">
                  <CapProgress
                    heading={scopeHeading(item)}
                    periodLabel={periodLabelOf(item.period)}
                    spendText="{formatAdCurrency(item.spend_to_date.amount_minor, currency)} / {formatAdCurrency(cap.amount.amount_minor, currency)}"
                    percentText={item.percentage === null || item.percentage === undefined
                      ? NO_VALUE
                      : fmt.number(item.percentage / 100, { style: 'percent', maximumFractionDigits: 0 })}
                    projectedText={formatAdCurrency(item.projected_spend.amount_minor, currency)}
                    projectedLabel={t['admin.advertising.budget.preview.projectedLabel']()}
                    freshnessText={
                      facts.stale
                        ? t['admin.advertising.budget.freshness.staleLabel']({
                            detail: freshnessSentence(facts, item),
                          })
                        : freshnessSentence(facts, item)
                    }
                    {status}
                    statusLabel={
                      status === 'hit'
                        ? t['admin.advertising.budget.status.hit']()
                        : status === 'warning'
                          ? t['admin.advertising.budget.status.warning']()
                          : t['admin.advertising.budget.status.ok']()
                    }
                    actionText={
                      reachedAction !== undefined ? thresholdActionLabel(reachedAction) : undefined
                    }
                    actionLabel={t['admin.advertising.budget.actions.configuredLabel']()}
                    ratio={cap.amount.amount_minor > 0
                      ? item.spend_to_date.amount_minor / cap.amount.amount_minor
                      : 0}
                  />
                  {#if writable}
                    <Button variant="secondary" size="sm" onclick={() => editCap(item)}>
                      {t['admin.advertising.budget.editCta']()}
                    </Button>
                  {/if}
                </div>
              {/each}
            </div>
          </Stack>
        </section>
      {/if}

      <section aria-labelledby="budget-form-heading">
        <Stack gap="4">
          <h2 id="budget-form-heading">{t['admin.advertising.budget.form.heading']()}</h2>
          {#if !writable}
            <Alert variant="info">{t['admin.advertising.budget.readOnly']()}</Alert>
          {:else if campaigns.length === 0 && connections.length === 0}
            <EmptyState
              title={t['admin.advertising.budget.form.noConnectionTitle']()}
              description={t['admin.advertising.budget.form.noConnectionDescription']()}
            />
          {:else}
            <form
              class="budget__form"
              onsubmit={(event) => {
                event.preventDefault()
                // doSave reports every failure to the form (or a dialog);
                // the rethrow only signals programmatic callers, so the
                // submit boundary swallows it instead of logging an
                // unhandled rejection on every failed save.
                void submit().catch(() => {})
              }}
            >
              <Stack gap="4">
                <Field label={t['admin.advertising.budget.form.scopeLabel']()} required>
                  {#snippet children(controlProps)}
                    <Select
                      {...controlProps}
                      bind:value={scope}
                      options={[
                        { value: 'tenant', label: t['admin.advertising.budget.scope.tenant']() },
                        {
                          value: 'campaign',
                          label: t['admin.advertising.budget.scope.campaign'](),
                        },
                      ]}
                    />
                  {/snippet}
                </Field>

                {#if scope === 'campaign'}
                  <Field label={t['admin.advertising.budget.form.campaignLabel']()} required>
                    {#snippet children(controlProps)}
                      <Select
                        {...controlProps}
                        bind:value={campaignId}
                        required
                        placeholder={t['admin.advertising.budget.form.campaignPlaceholder']()}
                        options={campaigns.map((campaign) => ({
                          value: campaign.id,
                          label: campaign.name,
                        }))}
                      />
                    {/snippet}
                  </Field>
                {/if}

                <Field label={t['admin.advertising.budget.form.periodLabel']()} required>
                  {#snippet children(controlProps)}
                    <Select
                      {...controlProps}
                      bind:value={periodChoice}
                      options={BUDGET_PERIODS.map((value) => ({
                        value,
                        label: periodLabelOf(value),
                      }))}
                    />
                  {/snippet}
                </Field>

                {#if crossCurrency}
                  <Field
                    label={t['admin.advertising.budget.form.currencyLabel']()}
                    required
                    hint={t['admin.advertising.budget.form.currencyHint']()}
                  >
                    {#snippet children(controlProps)}
                      <Select
                        {...controlProps}
                        bind:value={capCurrency}
                        required
                        options={capCurrencyChoices()}
                      />
                    {/snippet}
                  </Field>
                  <Field
                    label={t['admin.advertising.budget.form.fxDateLabel']()}
                    hint={t['admin.advertising.budget.form.fxDateHint']()}
                  >
                    {#snippet children(controlProps)}
                      <Input {...controlProps} type="date" bind:value={fxRateDate} />
                    {/snippet}
                  </Field>
                {/if}

                <Field
                  label={t['admin.advertising.budget.form.amountLabel']({ currency: formCurrency })}
                  required
                  error={!formAmountValid && amountMinor !== ''
                    ? t['admin.advertising.budget.form.integerError']()
                    : undefined}
                >
                  {#snippet children(controlProps)}
                    <Input
                      {...controlProps}
                      value={amountMinor}
                      inputmode="numeric"
                      required
                      oninput={(event) => {
                        amountMinor = event.currentTarget.value
                      }}
                    />
                  {/snippet}
                </Field>

                <Field
                  label={t['admin.advertising.budget.form.autoPauseLabel']()}
                  hint={t['admin.advertising.budget.form.autoPauseHint']()}
                >
                  {#snippet children(controlProps)}
                    <Select
                      {...controlProps}
                      bind:value={autoPauseChoice}
                      options={[
                        { value: 'false', label: t['admin.advertising.budget.form.off']() },
                        { value: 'true', label: t['admin.advertising.budget.form.on']() },
                      ]}
                    />
                  {/snippet}
                </Field>

                {#if formAmountValid && formCurrency}
                  <div class="budget__preview">
                    <h3>{t['admin.advertising.budget.preview.heading']()}</h3>
                    {#if needsDryRun}
                      <!-- Cross-currency basis: the dry-run counts current
                           spend in the proposed currency/basis — never a
                           relabelled spend-status amount — the run rate is
                           converted at the dry-run's own factor, and the
                           breach is interpolated from the converted pair,
                           so all three figures stay in one currency. -->
                      {#if dryRunPending}
                        <p class="budget__preview-freshness">
                          {t['admin.advertising.budget.preview.dryRunLoading']()}
                        </p>
                      {:else if preview?.usesDryRun}
                        <dl class="budget__preview-list">
                          <div>
                            <dt>{t['admin.advertising.budget.preview.currentLabel']()}</dt>
                            <dd>{preview.spendText}</dd>
                          </div>
                          <div>
                            <dt>{t['admin.advertising.budget.preview.projectedLabel']()}</dt>
                            <dd>{preview.projectedText}</dd>
                          </div>
                          <div>
                            <dt>{t['admin.advertising.budget.preview.breachLabel']()}</dt>
                            <dd>
                              {#if preview.breachDate}
                                {t['admin.advertising.budget.preview.breachValue']({
                                  date: fmt.date(`${preview.breachDate}T00:00:00`, 'medium'),
                                })}
                              {:else}
                                {t['admin.advertising.budget.preview.noBreach']()}
                              {/if}
                            </dd>
                          </div>
                        </dl>
                        <p class="budget__preview-freshness">
                          {t['admin.advertising.budget.preview.fxBasisNote']({
                            currency: preview.currency,
                          })}
                          {freshnessSentence(preview.facts)}
                        </p>
                      {:else}
                        <p class="budget__preview-freshness">
                          {t['admin.advertising.budget.preview.dryRunUnavailable']()}
                          {freshnessSentence(formItem ? freshnessFacts(formItem) : undefined, formItem ?? undefined)}
                        </p>
                      {/if}
                    {:else}
                      <dl class="budget__preview-list">
                        <div>
                          <dt>{t['admin.advertising.budget.preview.currentLabel']()}</dt>
                          <dd>{preview?.spendText}</dd>
                        </div>
                        <div>
                          <dt>{t['admin.advertising.budget.preview.projectedLabel']()}</dt>
                          <dd>
                            {#if preview && !preview.usesDryRun}{preview.projectedText}{/if}
                          </dd>
                        </div>
                        <div>
                          <dt>{t['admin.advertising.budget.preview.breachLabel']()}</dt>
                          <dd>
                            {#if preview && !preview.usesDryRun && preview.breachDate}
                              {t['admin.advertising.budget.preview.breachValue']({
                                date: fmt.date(`${preview.breachDate}T00:00:00`, 'medium'),
                              })}
                            {:else}
                              {t['admin.advertising.budget.preview.noBreach']()}
                            {/if}
                          </dd>
                        </div>
                      </dl>
                      <p class="budget__preview-freshness">
                        {t['admin.advertising.budget.preview.projectedNote']()}
                        {freshnessSentence(preview?.facts)}
                      </p>
                    {/if}
                  </div>
                {/if}

                {#if crossCurrency && !capCurrency}
                  <Alert variant="warning">
                    {t['admin.advertising.budget.form.fxBasisRequired']()}
                  </Alert>
                {/if}

                {#if formError}
                  <Alert variant="error">{formError}</Alert>
                {/if}

                <div>
                  <Button type="submit" variant="primary" loading={saving} disabled={!writable}>
                    {t['admin.advertising.budget.form.submit']()}
                  </Button>
                </div>
              </Stack>
            </form>
          {/if}
        </Stack>
      </section>
    {/if}
  </Stack>
</Container>

<!-- The raise/auto-pause confirmation: consequence copy states the pause
     figure, the affected scope, and the no-auto-resume rule; a raise shows
     its daily and projected monthly delta; auto-pause additionally requires
     the typed pause figure. -->
<ConsequenceDialog
  bind:open={confirmOpen}
  titleText={
    autoPause
      ? t['admin.advertising.budget.confirm.pauseTitle']()
      : t['admin.advertising.budget.confirm.raiseTitle']()
  }
  consequence={confirmConsequence}
  figures={deltaFigures()}
  confirmationPhrase={confirmPhrase}
  confirmationLabel={t['admin.advertising.budget.confirm.phraseLabel']()}
  confirmLabel={t['admin.advertising.budget.confirm.cta']()}
  cancelLabel={t['common.cancel']()}
  submitting={confirmSubmitting}
  errorMessage={confirmError}
  onConfirm={onConfirm}
/>

<!-- The backend's 409: lowering below the period's spend so far. Warns that
     this can pause campaigns immediately, then retries with the explicit
     confirmation flag. -->
<ConsequenceDialog
  bind:open={belowSpendOpen}
  titleText={t['admin.advertising.budget.belowSpend.title']()}
  consequence={t['admin.advertising.budget.belowSpend.consequence']({
    figure: formatAdCurrency(Number(amountMinor.trim() || '0'), formCurrency),
  })}
  confirmLabel={t['admin.advertising.budget.belowSpend.cta']()}
  cancelLabel={t['common.cancel']()}
  variant="warning"
  onConfirm={onBelowSpendConfirm}
/>

<style>
  .budget__disclosure {
    margin: 0;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }

  .budget__caps {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(var(--sanvi-spacing-48), 1fr));
    gap: var(--sanvi-spacing-4);
    align-items: start;
  }

  .budget__cap {
    display: flex;
    flex-direction: column;
    align-items: start;
    gap: var(--sanvi-spacing-2);
  }

  .budget__form {
    max-width: var(--sanvi-spacing-48);
  }

  .budget__preview {
    border: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-md);
    padding: var(--sanvi-spacing-4);
    background: var(--sanvi-color-background-secondary);
  }

  .budget__preview h3 {
    margin: 0 0 var(--sanvi-spacing-2);
    font-size: var(--sanvi-font-size-sm);
    font-weight: var(--sanvi-font-weight-semibold);
    color: var(--sanvi-color-text-secondary);
  }

  .budget__preview-list {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-1);
  }

  .budget__preview-list div {
    display: flex;
    justify-content: space-between;
    gap: var(--sanvi-spacing-2);
  }

  .budget__preview-list dt {
    color: var(--sanvi-color-text-secondary);
  }

  .budget__preview-list dd {
    margin: 0;
    font-variant-numeric: tabular-nums;
    color: var(--sanvi-color-text-primary);
  }

  .budget__preview-freshness {
    margin: var(--sanvi-spacing-2) 0 0;
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
  }

  .budget__flag-off-note {
    margin: 0;
    color: var(--sanvi-color-text-secondary);
  }
</style>
