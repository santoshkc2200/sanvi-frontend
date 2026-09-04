/**
 * Presentation logic for the campaign manager (phase 10, TASK-012) —
 * the layer between contract types and localized UI: change-log entries as
 * readable history, drift diff rows, budget confirmation math, and the
 * per-currency budget sums the bulk actions must name before confirming.
 *
 * Matrix/status values never appear as literals here: labels resolve through
 * the i18n catalog by key (`admin.advertising.change.field.<value>`), falling
 * back to the raw value the way the connection screen resolves scope names.
 */
import type {
  Campaign,
  CampaignChange,
  CampaignView,
  ConnectionView,
  PlatformView,
} from '@sanvi/api-client'
import {
  formatAdCurrency,
  humanizeOptionValue,
  type AdChangeItem,
  type DriftDiffRow,
} from '@sanvi/ui'
import { fmt, t } from '@sanvi/i18n'

type Catalog = Record<string, (params?: Record<string, string | number>) => string>

/** The catalog as a dynamic key space — for labels keyed by *data* values. */
function catalog(): Catalog {
  return t as unknown as Catalog
}

/** A parameterized message by dynamic key, or the key itself if absent. */
function message(key: string, params?: Record<string, string | number>): string {
  const entry = catalog()[key]
  return typeof entry === 'function' ? entry(params) : key
}

/** Localized label for a data-driven value, or the humanized raw value. */
export function dataLabel(prefix: string, value: string): string {
  const entry = catalog()[`${prefix}${value}`]
  return typeof entry === 'function' ? entry() : humanizeOptionValue(value)
}

export function fieldLabel(field: string): string {
  return dataLabel('admin.advertising.change.field.', field)
}

export function statusLabel(status: string): string {
  return dataLabel('admin.advertising.status.', status)
}

export function budgetKindLabel(kind: string): string {
  return dataLabel('admin.advertising.option.', kind)
}

/** Money in the ad account's currency, natively — never silently converted. */
export function money(amountMinor: number, currency: string): string {
  return formatAdCurrency(amountMinor, currency)
}

/** The budget cell / confirmation line: "¥1,000 (Daily)" in the account's currency. */
export function budgetLine(campaign: Campaign, currency: string): string {
  return `${money(campaign.budget.amount.amount_minor, currency)} (${budgetKindLabel(campaign.budget.kind)})`
}

// ---------------------------------------------------------------------------
// List helpers
// ---------------------------------------------------------------------------

export function connectionFor(
  view: CampaignView,
  connections: ConnectionView[],
): ConnectionView | undefined {
  return connections.find((connection) => connection.id === view.connection_id)
}

/** Platform display names keyed by platform key, from the catalog. */
export function platformNames(platforms: PlatformView[]): Record<string, string> {
  return Object.fromEntries(platforms.map((platform) => [platform.key, platform.display_name]))
}

/**
 * Per-currency combined daily-equivalent budget of the affected campaigns.
 * Currencies are never added together — mixing two ad accounts' money into
 * one number is how a confirmation starts lying — so the dialog shows one
 * line per currency present.
 */
export function combinedBudgetsByCurrency(
  views: CampaignView[],
  currencyOf: (view: CampaignView) => string | undefined,
): { currency: string; amountMinor: number }[] {
  const totals = new Map<string, number>()
  for (const view of views) {
    const currency = currencyOf(view)
    if (!currency) continue
    totals.set(currency, (totals.get(currency) ?? 0) + view.campaign.budget.amount.amount_minor)
  }
  return [...totals.entries()]
    .map(([currency, amountMinor]) => ({ currency, amountMinor }))
    .sort((a, b) => a.currency.localeCompare(b.currency))
}

// ---------------------------------------------------------------------------
// Budget confirmation — "our UI spends the tenant's money"
// ---------------------------------------------------------------------------

/**
 * The increase ratio above which a budget change must be confirmed with its
 * actual delta. Per-tenant configuration arrives with the budget-guardrails
 * slice (TASK-017); until that surface exists the product default is a 20 %
 * jump, which matches the guardrails' warning threshold's spirit: small
 * adjustments flow, a real step up asks first.
 */
export const BUDGET_CONFIRM_INCREASE_RATIO = 1.2

/** Projected monthly spend for a daily budget: thirty days, stated as an estimate. */
export const PROJECTED_MONTH_DAYS = 30

export interface BudgetIncreaseConfirmation {
  required: boolean
  previousMinor?: number
  nextMinor?: number
  /** Daily delta in minor units (positive = increase). */
  dailyDeltaMinor: number
  /** Projected monthly delta, minor units, at the projection constant above. */
  monthlyDeltaMinor: number
  currency: string
}

export function budgetIncrease(
  previousMinor: number,
  nextMinor: number,
  currency: string,
): BudgetIncreaseConfirmation {
  const dailyDeltaMinor = nextMinor - previousMinor
  return {
    required: previousMinor > 0 && nextMinor > previousMinor * BUDGET_CONFIRM_INCREASE_RATIO,
    previousMinor,
    nextMinor,
    dailyDeltaMinor,
    monthlyDeltaMinor: dailyDeltaMinor * PROJECTED_MONTH_DAYS,
    currency,
  }
}

// ---------------------------------------------------------------------------
// Change log → readable history
// ---------------------------------------------------------------------------

/** Readable value of one changed field from a campaign state snapshot. */
function stateValue(state: Campaign, field: string): string {
  switch (field) {
    case 'name':
      return state.name
    case 'objective':
      return dataLabel('admin.advertising.option.', state.objective)
    case 'budget':
      return `${money(state.budget.amount.amount_minor, state.budget.amount.currency)} (${budgetKindLabel(state.budget.kind)})`
    case 'schedule': {
      if (!state.schedule || (!state.schedule.starts_at && !state.schedule.ends_at)) {
        return message('admin.advertising.change.scheduleNone')
      }
      const parts = []
      if (state.schedule.starts_at) parts.push(fmt.datetime(state.schedule.starts_at, 'medium'))
      if (state.schedule.ends_at) parts.push(fmt.datetime(state.schedule.ends_at, 'medium'))
      return parts.join(' — ')
    }
    case 'ad_groups':
      return message('admin.advertising.change.adGroupCount', { count: state.ad_groups.length })
    case 'status':
      return statusLabel(state.status)
    default:
      return humanizeOptionValue(field)
  }
}

/**
 * Builds the timeline items for the detail view. Actor resolution: the app
 * passes names it knows (from the member directory, when the operator's
 * role can read it); platform-sourced changes are attributed to the platform
 * itself — "who paused this" must have an answer either way.
 */
export function changeItems(
  changes: CampaignChange[],
  options: { platformName: string; actorName?: (actorId: string) => string | undefined },
): AdChangeItem[] {
  return changes.map((change) => {
    const platformSourced = change.source !== 'sanvi'
    const actor = platformSourced
      ? options.platformName
      : (change.actor_id !== undefined && options.actorName?.(change.actor_id)) ||
        (change.actor_id ?? message('admin.advertising.change.unknownActor'))
    const heading = platformSourced
      ? message('admin.advertising.change.platformHeading', { actor })
      : message('admin.advertising.change.sanviHeading', { actor })

    const fields = change.changed_fields.map(fieldLabel)
    const details = change.changed_fields
      .filter((field) => field !== 'ad_groups' && field !== 'external_id')
      .map((field) => ({
        field: fieldLabel(field),
        before: stateValue(change.before_state, field),
        after: stateValue(change.after_state, field),
      }))

    return {
      id: change.id,
      heading,
      meta: fmt.datetime(change.created_at, 'medium'),
      source: {
        label: platformSourced
          ? message('admin.advertising.change.sourcePlatform')
          : message('admin.advertising.change.sourceSanvi'),
        variant: platformSourced ? 'warning' : 'info',
      },
      fields,
      details,
    }
  })
}

/**
 * The drift diff rows from the newest platform-sourced change: its
 * `before_state` is our intent, its `after_state` is the platform's current
 * answer. Publish-only bookkeeping fields (the platform-assigned id) carry
 * no intent to diff, so they are excluded — the header states the drifted
 * fields separately, and the diff must never contradict it by omission of a
 * *meaningful* field.
 */
export function driftRows(change: CampaignChange | undefined): DriftDiffRow[] {
  if (!change) return []
  return change.changed_fields
    .filter((field) => field !== 'external_id')
    .map((field) => ({
      field: fieldLabel(field),
      ours: stateValue(change.before_state, field),
      theirs: stateValue(change.after_state, field),
    }))
}
