/**
 * Presentation logic for the ROAS dashboard (phase 10, TASK-016) — the
 * pure layer between the metrics contract and the localized UI: date
 * ranges, per-currency KPI groups, chart series in major units, campaign
 * breakdown rows, and freshness/timezone statements.
 *
 * The invariants this file refuses to break: money is never summed across
 * currencies (every grouping keys on the row's currency first), the two
 * revenue sources never merge (platform-reported and Sanvi-observed travel
 * as separate fields everywhere), and a ratio with a zero or unmeasured
 * side is `null` — the UI's em dash, never `∞` or a confident `0`.
 *
 * Path note: this tree is a matrix "form path" for the platform-literal
 * gate, and platform facts (names, keys) stay data-driven end to end.
 */
import type {
  ConnectionFreshnessView,
  ConnectionView,
  MetricPoint,
  MetricsSummaryRow,
} from '@sanvi/api-client'
import { minorUnitDigits } from '@sanvi/ui'

// ---------------------------------------------------------------------------
// Date ranges
// ---------------------------------------------------------------------------

export interface DateRange {
  /** Inclusive start, `YYYY-MM-DD`. */
  from: string
  /** Inclusive end, `YYYY-MM-DD`. */
  to: string
}

export type RangePreset = '7d' | '14d' | '30d'

export const RANGE_PRESETS: RangePreset[] = ['7d', '14d', '30d']

/** `YYYY-MM-DD` for a UTC calendar date — the same shape the contract uses. */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return isoDate(date)
}

/** The calendar window a preset covers, ending *today* (UTC calendar). */
export function rangeForPreset(preset: RangePreset, today = isoDate(new Date())): DateRange {
  const days = Number(preset.slice(0, -1))
  return { from: addDays(today, -(days - 1)), to: today }
}

/** The equal-length period immediately before a range — the comparison basis. */
export function previousRange(range: DateRange): DateRange {
  const span = daysBetween(range.from, range.to)
  return { from: addDays(range.from, -span), to: addDays(range.to, -span) }
}

/** Inclusive day count of a range (≥ 1). */
export function daysBetween(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00Z`).getTime()
  const end = new Date(`${to}T00:00:00Z`).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 1
  return Math.max(1, Math.round((end - start) / 86_400_000) + 1)
}

// ---------------------------------------------------------------------------
// Money & ratios
// ---------------------------------------------------------------------------

/** Minor units → major units for chart scaling (¥2000 JPY → 2000; ¢1999 USD → 19.99). */
export function toMajorUnits(amountMinor: number, currency: string): number {
  return amountMinor / 10 ** minorUnitDigits(currency)
}

/**
 * A ratio that only exists when both sides are measured and positive —
 * zero spend, zero revenue, and `null` upstream all mean "not computable",
 * and the em dash the UI renders is the honest answer.
 */
export function ratioOf(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
): number | null {
  if (
    numerator === null ||
    numerator === undefined ||
    denominator === null ||
    denominator === undefined ||
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    numerator <= 0 ||
    denominator <= 0
  ) {
    return null
  }
  return numerator / denominator
}

/** Signed fractional change, `null` when the previous period has no base. */
export function fractionChange(
  current: number | null | undefined,
  previous: number | null | undefined,
): number | null {
  if (
    current === null ||
    current === undefined ||
    previous === null ||
    previous === undefined ||
    !Number.isFinite(current) ||
    !Number.isFinite(previous) ||
    previous <= 0
  ) {
    return null
  }
  return (current - previous) / previous
}

// ---------------------------------------------------------------------------
// KPI summary — one group per currency, current + previous side by side
// ---------------------------------------------------------------------------

export interface KpiPeriod {
  spendMinor: number
  platformValueMinor: number
  sanviRevenueMinor: number
  conversions: number
  clicks: number
  impressions: number
  roasPlatform: number | null
  roasSanvi: number | null
  restating: boolean
}

export interface KpiGroup {
  currency: string
  current: KpiPeriod
  previous?: KpiPeriod
}

function periodFromSummary(row: MetricsSummaryRow): KpiPeriod {
  const spendMinor = row.spend.amount_minor
  return {
    spendMinor,
    platformValueMinor: row.conversion_value.amount_minor,
    sanviRevenueMinor: row.sanvi_revenue.amount_minor,
    conversions: row.conversions,
    clicks: row.clicks,
    impressions: row.impressions,
    // Each ratio stays on its own revenue field: platform ROAS divides the
    // platform's conversion value by spend, Sanvi ROAS divides Sanvi-observed
    // revenue by spend. Prefer the backend's own values; recompute only when
    // absent (fixtures). Crossing the two revenue fields is the one bug this
    // slice must never ship.
    roasPlatform:
      row.roas_platform !== null && row.roas_platform !== undefined
        ? row.roas_platform
        : ratioOf(row.conversion_value.amount_minor, spendMinor),
    roasSanvi:
      row.roas_sanvi !== null && row.roas_sanvi !== undefined
        ? row.roas_sanvi
        : ratioOf(row.sanvi_revenue.amount_minor, spendMinor),
    restating: row.restating,
  }
}

/**
 * One KPI group per currency, in a stable order. The backend already
 * refuses to produce a cross-currency total (`MetricsSummaryResponse` is a
 * list); this mapping keeps that shape instead of collapsing it.
 */
export function kpiGroups(
  current: MetricsSummaryRow[],
  compared?: MetricsSummaryRow[] | null,
): KpiGroup[] {
  const previousByCurrency = new Map((compared ?? []).map((row) => [row.currency, row]))
  return [...current]
    .sort((a, b) => a.currency.localeCompare(b.currency))
    .map((row) => ({
      currency: row.currency,
      current: periodFromSummary(row),
      ...(previousByCurrency.has(row.currency)
        ? { previous: periodFromSummary(previousByCurrency.get(row.currency)!) }
        : {}),
    }))
}

// ---------------------------------------------------------------------------
// Chart series — per currency, per day, major units
// ---------------------------------------------------------------------------

export interface CurrencyChartGroup {
  currency: string
  /** Sorted YYYY-MM-DD dates present for this currency. */
  dates: string[]
  /** Major-unit series aligned to `dates`. */
  spend: number[]
  platformValue: (number | null)[]
  sanviRevenue: (number | null)[]
  /** Per-platform spend stacks, aligned to `dates`; keys are platform ids from the data. */
  platformSpend: { key: string; values: (number | null)[] }[]
  /** Per-date restatement text from the caller, or null when settled. */
  restating: boolean[]
  hasSpend: boolean
}

/**
 * Groups query rows by currency and reshapes them into chart series.
 * Within a currency, per-day sums are legitimate — the ban is on
 * *cross-currency* sums. All values convert to major units so chart ticks
 * read as money, and `platform` labels come from the rows themselves.
 */
export function chartGroups(rows: MetricPoint[]): CurrencyChartGroup[] {
  const byCurrency = new Map<string, MetricPoint[]>()
  for (const row of rows) {
    const bucket = byCurrency.get(row.spend.currency) ?? []
    bucket.push(row)
    byCurrency.set(row.spend.currency, bucket)
  }

  return [...byCurrency.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, currencyRows]) => {
      const byDate = new Map<string, MetricPoint[]>()
      for (const row of currencyRows) {
        const bucket = byDate.get(row.date) ?? []
        bucket.push(row)
        byDate.set(row.date, bucket)
      }
      const dates = [...byDate.keys()].sort()
      const digits = minorUnitDigits(currency)

      let spend = 0
      const dailySpend: number[] = []
      const dailyPlatformValue: (number | null)[] = []
      const dailySanviRevenue: (number | null)[] = []
      const restating: boolean[] = []
      const platforms = new Map<string, (number | null)[]>()

      for (const date of dates) {
        const dayRows = byDate.get(date) ?? []
        const daySpend = dayRows.reduce((total, row) => total + row.spend.amount_minor, 0)
        spend += daySpend
        dailySpend.push(daySpend / 10 ** digits)
        dailyPlatformValue.push(
          dayRows.some((row) => row.conversion_value.amount_minor !== 0)
            ? dayRows.reduce((total, row) => total + row.conversion_value.amount_minor, 0) /
                10 ** digits
            : null,
        )
        dailySanviRevenue.push(
          dayRows.some((row) => row.sanvi_revenue.amount_minor !== 0)
            ? dayRows.reduce((total, row) => total + row.sanvi_revenue.amount_minor, 0) /
                10 ** digits
            : null,
        )
        restating.push(dayRows.some((row) => row.restating))

        for (const row of dayRows) {
          const key = row.platform ?? ''
          const series: (number | null)[] =
            platforms.get(key) ?? Array.from({ length: dates.length }, () => null)
          const slot = dates.indexOf(date)
          series[slot] = (series[slot] ?? 0) + row.spend.amount_minor / 10 ** digits
          platforms.set(key, series)
        }
      }

      return {
        currency,
        dates,
        spend: dailySpend,
        platformValue: dailyPlatformValue,
        sanviRevenue: dailySanviRevenue,
        platformSpend: [...platforms.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, values]) => ({ key, values })),
        restating,
        hasSpend: spend > 0,
      }
    })
}

// ---------------------------------------------------------------------------
// Campaign breakdown rows
// ---------------------------------------------------------------------------

export interface CampaignMetricRow {
  campaignId: string
  currency: string
  spendMinor: number
  clicks: number
  impressions: number
  conversions: number
  platformValueMinor: number
  sanviRevenueMinor: number
  roasPlatform: number | null
  roasSanvi: number | null
  restating: boolean
}

/**
 * Aggregates campaign-grain rows (one per campaign per day) into one row
 * per campaign. A campaign lives in exactly one ad account, so its
 * currency is constant and within-campaign sums are legitimate.
 */
export function campaignRows(rows: MetricPoint[]): CampaignMetricRow[] {
  const byCampaign = new Map<string, MetricPoint[]>()
  for (const row of rows) {
    if (row.campaign_id === undefined) continue
    const bucket = byCampaign.get(row.campaign_id) ?? []
    bucket.push(row)
    byCampaign.set(row.campaign_id, bucket)
  }

  return [...byCampaign.entries()]
    .map(([campaignId, campaignPoints]) => {
      const spendMinor = campaignPoints.reduce((total, row) => total + row.spend.amount_minor, 0)
      const platformValueMinor = campaignPoints.reduce(
        (total, row) => total + row.conversion_value.amount_minor,
        0,
      )
      const sanviRevenueMinor = campaignPoints.reduce(
        (total, row) => total + row.sanvi_revenue.amount_minor,
        0,
      )
      const conversions = campaignPoints.reduce((total, row) => total + row.conversions, 0)
      const explicitPlatform = campaignPoints.find(
        (row) => row.roas_platform !== null && row.roas_platform !== undefined,
      )?.roas_platform
      const explicitSanvi = campaignPoints.find(
        (row) => row.roas_sanvi !== null && row.roas_sanvi !== undefined,
      )?.roas_sanvi
      return {
        campaignId,
        currency: campaignPoints[0]?.spend.currency ?? '',
        spendMinor,
        clicks: campaignPoints.reduce((total, row) => total + row.clicks, 0),
        impressions: campaignPoints.reduce((total, row) => total + row.impressions, 0),
        conversions,
        platformValueMinor,
        sanviRevenueMinor,
        roasPlatform:
          explicitPlatform !== null && explicitPlatform !== undefined
            ? explicitPlatform
            : ratioOf(platformValueMinor, spendMinor),
        roasSanvi:
          explicitSanvi !== null && explicitSanvi !== undefined
            ? explicitSanvi
            : ratioOf(sanviRevenueMinor, spendMinor),
        restating: campaignPoints.some((row) => row.restating),
      }
    })
    .sort((a, b) => a.campaignId.localeCompare(b.campaignId))
}

// ---------------------------------------------------------------------------
// Freshness & timezone statements
// ---------------------------------------------------------------------------

export interface FreshnessView {
  /** Connections the backend marks stalled — "sync failed", shown as stale. */
  stalled: ConnectionFreshnessView[]
  /** Connections that have never ingested anything. */
  pending: ConnectionFreshnessView[]
  /** Connections ingesting recently enough to be current. */
  current: ConnectionFreshnessView[]
  anyStalled: boolean
}

/** Partitions freshness rows; the stalled flag is the backend's call, never a clock guess. */
export function freshnessState(connections: ConnectionFreshnessView[]): FreshnessView {
  const stalled = connections.filter((connection) => connection.stalled)
  const pending = connections.filter(
    (connection) => !connection.stalled && !connection.last_ingested_at,
  )
  const current = connections.filter(
    (connection) => !connection.stalled && connection.last_ingested_at != null,
  )
  return {
    stalled,
    pending,
    current,
    anyStalled: stalled.length > 0,
  }
}

/** Distinct ad-account timezones, sorted — the dashboard states them, never reconciles them. */
export function distinctTimezones(connections: ConnectionView[]): string[] {
  return [...new Set(connections.map((connection) => connection.timezone))].sort()
}
