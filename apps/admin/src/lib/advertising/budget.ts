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
 * spend-to-date and its projected spend at period end. Everything going in
 * is a backend figure; the only new arithmetic is the interpolation, which
 * is why every caller must render the result as *projected*, with the
 * freshness caveat attached. Undefined when the run rate never reaches the
 * cap this period. A cap already consumed reads as breached today.
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

  const [start, end] =
    period === BUDGET_PERIOD_MONTHLY
      ? [utcMonthStart(now), utcMonthEnd(now)]
      : [utcDayStart(now), utcDayEnd(now)]
  const fraction = (capMinor - spendToDateMinor) / growth
  const breach = new Date(start.getTime() + fraction * (end.getTime() - start.getTime()))
  return { date: utcDateKey(breach) }
}

function utcDayStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

function utcDayEnd(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
}

function utcMonthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

function utcMonthEnd(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
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
