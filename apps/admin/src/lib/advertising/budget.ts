import type { BudgetPeriod, SpendStatusItem } from '@sanvi/api-client'
import { BUDGET_PERIOD_DAILY, BUDGET_PERIOD_MONTHLY } from '../budget-periods'

/**
 * Pure helpers for the budget-guardrail screens (phase 10, TASK-017).
 *
 * The division of labour the contract enforces holds here too: the backend
 * supplies the figures (spend to date, run-rate projection, percentage, the
 * configured per-threshold actions) and these helpers only *present* them —
 * mapping a percentage to a threshold state, or interpolating a projected
 * breach date for a cap that does not exist yet. No helper recomputes spend,
 * a run rate, or a percentage from raw metrics.
 */

/** Cap-consumption states the CapProgress indicator renders. Colour never
    carries these alone — every state also renders as a status word. */
export type CapStatus = 'ok' | 'warning' | 'hit'

/** The threshold state for one spend-status item, from the backend's own
    percentage. Exactly-at-threshold belongs to the threshold (80.0 is a
    warning, 100.0 a breach) — the evaluator fires at >=, so the label must
    not read "approaching" at the figure where the alert already fired. */
export function capStatusFor(percentage: number | null | undefined): CapStatus {
  if (percentage === null || percentage === undefined) return 'ok'
  if (percentage >= 100) return 'hit'
  if (percentage >= 80) return 'warning'
  return 'ok'
}

/** `scope` string → the campaign id, or undefined for the tenant scope. */
export function scopeCampaignId(scope: string): string | undefined {
  return scope.startsWith('campaign:') ? scope.slice('campaign:'.length) : undefined
}

/**
 * The two delta rows a raise/lower confirmation must show, in minor units,
 * all-integer except the monthly projection of a daily delta (exact — days
 * are whole) and the daily average of a monthly delta (stated as an
 * average; the projection constant is the same 30-day month the campaign
 * budget confirmation uses).
 */
export const PROJECTED_MONTH_DAYS = 30

export interface CapDeltaRows {
  /** The delta in the cap's own period. */
  primaryLabelKey: 'admin.advertising.budget.delta.daily' | 'admin.advertising.budget.delta.monthly'
  primaryMinor: number
  /** The delta in the other period, on the stated projection basis. */
  derivedLabelKey:
    | 'admin.advertising.budget.delta.monthlyProjected'
    | 'admin.advertising.budget.delta.dailyAverage'
  derivedMinor: number
  /** True when the change raises the cap. */
  increase: boolean
}

export function capDeltaRows(
  period: BudgetPeriod,
  previousMinor: number,
  nextMinor: number,
): CapDeltaRows | undefined {
  if (!Number.isSafeInteger(previousMinor) || !Number.isSafeInteger(nextMinor)) return undefined
  if (previousMinor === nextMinor) return undefined
  const delta = nextMinor - previousMinor
  if (period === BUDGET_PERIOD_DAILY) {
    return {
      primaryLabelKey: 'admin.advertising.budget.delta.daily',
      primaryMinor: delta,
      derivedLabelKey: 'admin.advertising.budget.delta.monthlyProjected',
      derivedMinor: delta * PROJECTED_MONTH_DAYS,
      increase: delta > 0,
    }
  }
  return {
    primaryLabelKey: 'admin.advertising.budget.delta.monthly',
    primaryMinor: delta,
    derivedLabelKey: 'admin.advertising.budget.delta.dailyAverage',
    // Rounded to the nearest minor unit — the row is labelled an average.
    derivedMinor: Math.round(delta / PROJECTED_MONTH_DAYS),
    increase: delta > 0,
  }
}

export interface BreachProjection {
  /** UTC calendar date (`YYYY-MM-DD`) the cap would be hit at the run rate. */
  date: string
}

function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * The live preview's third figure: the date a *not-yet-saved* cap would be
 * hit at the current run rate, interpolated between the backend's own
 * spend-to-date (the figure *now*) and its projected spend at period end.
 * Everything going in is a backend figure; the only new arithmetic is the
 * interpolation, which is why every caller must render the result as
 * *projected*, with the freshness caveat attached. Undefined when the run
 * rate never reaches the cap this period. A cap already consumed reads as
 * breached today.
 */
export function projectedBreachDate(
  period: BudgetPeriod,
  capMinor: number,
  spendToDateMinor: number,
  projectedSpendMinor: number,
  now: Date = new Date(),
): BreachProjection | undefined {
  if (!Number.isFinite(capMinor) || capMinor <= 0) return undefined
  if (capMinor <= spendToDateMinor) return { date: utcDateKey(now) }
  const growth = projectedSpendMinor - spendToDateMinor
  if (growth <= 0 || projectedSpendMinor < capMinor) return undefined

  // Spend-to-date is the figure *now*; the remaining growth plays out
  // between now and period end — never from period start, which would
  // backdate the breach into days already spent.
  const end = period === BUDGET_PERIOD_MONTHLY ? utcMonthEnd(now) : utcDayEnd(now)
  if (end.getTime() <= now.getTime()) return { date: utcDateKey(now) }
  const fraction = (capMinor - spendToDateMinor) / growth
  const breach = new Date(now.getTime() + fraction * (end.getTime() - now.getTime()))
  return { date: utcDateKey(breach) }
}

function utcDayEnd(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
}

function utcMonthEnd(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
}

export interface ConvertedRunRate {
  /** Spend to date, converted — the dry-run's own figure, verbatim. */
  spendMinor: number
  /** Projected spend, converted at the dry-run's factor, rounded. */
  projectedMinor: number
}

/**
 * Largest share of the growth (or converted total) the backend's minor-unit
 * rounding may account for before the conversion is declined as unreliable.
 */
const MAX_CONVERSION_ROUNDING_SHARE = 0.02

/**
 * Whether the cap-amount field holds a whole number of minor units the
 * client can represent exactly. Digit-only input beyond
 * `Number.MAX_SAFE_INTEGER` parses to a *different* value (`9007199254740993`
 * becomes `9007199254740992`) and far larger input parses to `Infinity`
 * (serializing as `null`) — either would save a different cap than the
 * operator entered — so the field is invalid until it is a safe integer
 * greater than zero.
 */
export function isCapAmountValid(text: string): boolean {
  const trimmed = text.trim()
  if (!/^\d+$/.test(trimmed)) return false
  const value = Number(trimmed)
  return Number.isSafeInteger(value) && value > 0
}

/**
 * Converts a spend-status run-rate pair into the proposed cap currency for
 * the cross-currency live preview.
 *
 * The backend's dry-run answers current spend in the proposed
 * currency/basis but carries no projected spend, while `spend-status`
 * carries the run-rate shape (spend-to-date → projected) in the *old*
 * basis only. The one honest bridge without a backend projection field:
 * the conversion factor the backend itself established —
 * `dryRunSpend / spendToDate` — which folds in both the FX rates and any
 * coverage change (spend-status excludes unconvertible currencies when no
 * cap exists; the dry-run converts with the declared basis). The projected
 * figure is that factor applied to the spend-status projection, so the
 * preview keeps all three figures — current spend, projected spend,
 * interpolated breach date — in one consistent currency, every one of them
 * labelled projected with the FX-basis note inline.
 *
 * Undefined when there is no basis for a factor (zero or invalid spend to
 * date), when the rounded growth is flat or negative, and when the
 * backend's minor-unit rounding of the projected total (≤0.5 units) would
 * stop being negligible: above a 2% share of the growth the breach date
 * could move materially on rounding alone (spend 1, projected 3 — true
 * growth 2.5±0.5, a 20% swing before any factor is applied), and above a
 * 2% share of the converted total the printed projection itself would be
 * unreliable. A flat-looking pair is the sharpest case — spend and
 * projected both rounding to 26 while the true projection sits ~2% higher
 * hides a boundary breach no client arithmetic can recover — so only a
 * backend-provided converted projection could decide it. Callers fall back
 * to the dry-run-unavailable note rather than printing any of these.
 * A `projected_spend` field on the backend's `DryRunEvaluationResult`
 * would let this helper — and its rounding — go away; until then the
 * authoritative evaluation stays the backend's on save.
 */
export function convertRunRateToDryRunBasis(
  spendToDateMinor: number,
  projectedSpendMinor: number,
  dryRunSpendMinor: number,
): ConvertedRunRate | undefined {
  if (
    !Number.isFinite(spendToDateMinor) ||
    !Number.isFinite(projectedSpendMinor) ||
    !Number.isFinite(dryRunSpendMinor)
  )
    return undefined
  if (spendToDateMinor <= 0 || projectedSpendMinor < 0 || dryRunSpendMinor < 0) return undefined
  const factor = dryRunSpendMinor / spendToDateMinor
  if (!Number.isFinite(factor) || factor < 0) return undefined
  const growth = projectedSpendMinor - spendToDateMinor
  // A flat or negative rounded growth can hide up to ±0.5 minor units of
  // true growth — including a boundary breach — so there is no growth
  // figure reliable enough to shape a breach date with: decline outright.
  // Otherwise the backend rounding of the projected total (≤0.5 minor
  // units) must stay a ≤2% share of the growth it shapes — the breach-date
  // sensitivity — and, amplified by the factor plus the final rounding, a
  // ≤2% share of the converted total it prints — the display sensitivity.
  if (growth <= 0) return undefined
  if (0.5 / growth > MAX_CONVERSION_ROUNDING_SHARE) return undefined
  const convertedTotal = projectedSpendMinor * factor
  if ((0.5 * factor + 0.5) / Math.max(convertedTotal, 1) > MAX_CONVERSION_ROUNDING_SHARE)
    return undefined
  return {
    spendMinor: dryRunSpendMinor,
    projectedMinor: Math.round(convertedTotal),
  }
}

/**
 * The configured action for the threshold the backend's percentage has
 * actually reached: 100% reads `threshold_100`, 80–99% reads
 * `threshold_80`, anything lower (or no percentage) has reached no
 * threshold. Rendering `threshold_100` at 80% promises a pause the backend
 * would not take — an auto-pause cap notifies at 80%.
 */
export function thresholdActionFor(
  percentage: number | null | undefined,
  actions: { threshold_80: string; threshold_100: string },
): string | undefined {
  if (percentage === null || percentage === undefined) return undefined
  if (percentage >= 100) return actions.threshold_100
  if (percentage >= 80) return actions.threshold_80
  return undefined
}

/**
 * Freshness sentence inputs for one item — the raw material the screen
 * renders through i18n. `stale` and `settled` come from the backend's
 * DataFreshness; a *provisional* tail (recent days still updating) is
 * visible as spend_to_date > settled_spend, which the screen surfaces with
 * the same "still updating" language the dashboard uses.
 */
export interface FreshnessFacts {
  stale: boolean
  settled: boolean
  lagHours: number | null
  lastSyncedAt: string | null
  provisionalMinor: number
}

export function freshnessFacts(item: SpendStatusItem): FreshnessFacts {
  return {
    stale: item.data_freshness.is_stale,
    settled: item.data_freshness.is_settled,
    lagHours: item.data_freshness.lag_hours ?? null,
    lastSyncedAt: item.data_freshness.last_synced_at ?? null,
    provisionalMinor: Math.max(
      0,
      item.spend_to_date.amount_minor - item.settled_spend.amount_minor,
    ),
  }
}
