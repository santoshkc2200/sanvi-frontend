import type { SpendStatusItem } from '@sanvi/api-client'
import { describe, expect, it } from 'vitest'
import { BUDGET_PERIOD_DAILY as DAILY, BUDGET_PERIOD_MONTHLY as MONTHLY } from '../budget-periods'
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
} from './budget'

describe('capStatusFor', () => {
  it('maps the backend percentage to the threshold states', () => {
    expect(capStatusFor(24)).toBe('ok')
    expect(capStatusFor(null)).toBe('ok')
    expect(capStatusFor(undefined)).toBe('ok')
  })

  it('reads exactly-at-threshold as the threshold state, not "approaching"', () => {
    // The evaluator fires at >=, so 80.0 must already read as the warning.
    expect(capStatusFor(80)).toBe('warning')
    expect(capStatusFor(79.9)).toBe('ok')
    expect(capStatusFor(100)).toBe('hit')
    expect(capStatusFor(99.9)).toBe('warning')
    expect(capStatusFor(240)).toBe('hit')
  })
})

describe('scopeCampaignId', () => {
  it('parses both scopes', () => {
    expect(scopeCampaignId('tenant')).toBeUndefined()
    expect(scopeCampaignId('campaign:873698342314721281')).toBe('873698342314721281')
  })
})

describe('capDeltaRows', () => {
  it('projects a daily delta onto a stated 30-day month, exactly', () => {
    const rows = capDeltaRows(DAILY, 5_000, 15_000)
    expect(rows).toEqual({
      primaryLabelKey: 'admin.advertising.budget.delta.daily',
      primaryMinor: 10_000,
      derivedLabelKey: 'admin.advertising.budget.delta.monthlyProjected',
      derivedMinor: 300_000,
      increase: true,
    })
  })

  it('averages a monthly delta per day, rounded to the nearest minor unit', () => {
    const rows = capDeltaRows(MONTHLY, 100_000, 101_000)
    expect(rows).toBeDefined()
    expect(rows?.primaryMinor).toBe(1_000)
    expect(rows?.derivedMinor).toBe(33)
    expect(rows?.increase).toBe(true)
  })

  it('reports the direction of a lowering too', () => {
    const rows = capDeltaRows(DAILY, 15_000, 5_000)
    expect(rows?.increase).toBe(false)
    expect(rows?.primaryMinor).toBe(-10_000)
  })

  it('is undefined for a no-op and for non-integer input', () => {
    expect(capDeltaRows(DAILY, 5_000, 5_000)).toBeUndefined()
    expect(capDeltaRows(DAILY, Number.NaN, 5_000)).toBeUndefined()
    expect(capDeltaRows(DAILY, 1.5, 5_000)).toBeUndefined()
  })
})

describe('projectedBreachDate', () => {
  // 2026-09-10 UTC; September has 30 days.
  const now = new Date('2026-09-10T12:00:00Z')

  it('interpolates the breach day from now, not period start, for a monthly cap', () => {
    // Spend 300k at Sep 10 12:00 UTC, projected 900k at Sep 30 end: cap
    // 600k is growth's midpoint — half the *remaining* 20.5 days after now
    // → Sep 20 18:00 UTC.
    const projection = projectedBreachDate(MONTHLY, 600_000, 300_000, 900_000, now)
    expect(projection?.date).toBe('2026-09-20')
  })

  it('interpolates within the day for a daily cap', () => {
    // Half the day's projected growth lands mid-day UTC.
    const projection = projectedBreachDate(DAILY, 1_000, 250, 1_250, now)
    expect(projection?.date).toBe('2026-09-10')
  })

  it('reads a cap already consumed as breached today', () => {
    const projection = projectedBreachDate(MONTHLY, 500, 600, 900, now)
    expect(projection?.date).toBe('2026-09-10')
  })

  it('is undefined when the run rate never reaches the cap this period', () => {
    expect(projectedBreachDate(MONTHLY, 2_000, 300, 900, now)).toBeUndefined()
    // No further growth projected either.
    expect(projectedBreachDate(MONTHLY, 2_000, 300, 300, now)).toBeUndefined()
  })

  it('guards a non-positive cap', () => {
    expect(projectedBreachDate(MONTHLY, 0, 0, 100, now)).toBeUndefined()
  })

  it('measures the day on the account clock, not UTC', () => {
    // 2026-09-10 12:00 UTC is 21:00 in Tokyo: the same figures breach
    // "today" on either clock here, but the key is the JST calendar date.
    const projection = projectedBreachDate(DAILY, 1_000, 250, 1_250, now, 'Asia/Tokyo')
    expect(projection?.date).toBe('2026-09-10')
  })

  it('can place the breach a day earlier than UTC for far-east zones', () => {
    // 2026-09-10 16:00 UTC is 2026-09-11 01:00 in Tokyo. A daily cap whose
    // growth ends at JST midnight breaches on Sep 11 JST…
    const late = new Date('2026-09-10T16:00:00Z')
    const zoned = projectedBreachDate(DAILY, 1_000, 900, 1_100, late, 'Asia/Tokyo')
    expect(zoned?.date).toBe('2026-09-11')
    // …while the UTC fallback still reads Sep 10.
    expect(projectedBreachDate(DAILY, 1_000, 900, 1_100, late)?.date).toBe('2026-09-10')
  })

  it('falls back to UTC for an unknown zone rather than refusing the preview', () => {
    const projection = projectedBreachDate(DAILY, 1_000, 250, 1_250, now, 'Not/AZone')
    expect(projection?.date).toBe('2026-09-10')
  })
})

describe('isCapRaise', () => {
  it('compares same-currency figures numerically', () => {
    expect(isCapRaise({ amountMinor: 5_000, currency: 'JPY' }, 10_000, 'JPY')).toBe(true)
    expect(isCapRaise({ amountMinor: 5_000, currency: 'JPY' }, 5_000, 'JPY')).toBe(false)
    expect(isCapRaise({ amountMinor: 5_000, currency: 'JPY' }, 1_000, 'JPY')).toBe(false)
    expect(isCapRaise(undefined, 10_000, 'JPY')).toBe(false)
  })

  it('always confirms across a currency change, either direction', () => {
    // 1,000 USD reads "smaller" than 100,000 JPY numerically, and a naive
    // comparison would call a material raise a reduction.
    expect(isCapRaise({ amountMinor: 100_000, currency: 'JPY' }, 1_000, 'USD')).toBe(true)
    expect(isCapRaise({ amountMinor: 1_000, currency: 'USD' }, 100_000, 'JPY')).toBe(true)
  })
})

describe('isCapAmountValid', () => {
  it('accepts whole minor-unit amounts with surrounding whitespace', () => {
    expect(isCapAmountValid('50000')).toBe(true)
    expect(isCapAmountValid('  50000  ')).toBe(true)
    expect(isCapAmountValid('007')).toBe(true)
  })

  it('rejects empty, non-digit, fractional, and non-positive input', () => {
    expect(isCapAmountValid('')).toBe(false)
    expect(isCapAmountValid('   ')).toBe(false)
    expect(isCapAmountValid('0')).toBe(false)
    expect(isCapAmountValid('-50')).toBe(false)
    expect(isCapAmountValid('50.5')).toBe(false)
    expect(isCapAmountValid('1e3')).toBe(false)
    expect(isCapAmountValid('50,000')).toBe(false)
  })

  it('rejects digit input beyond the safe-integer range — it would save a different cap', () => {
    // Parses to 9007199254740992: the operator's figure would not survive.
    expect(isCapAmountValid('9007199254740993')).toBe(false)
    // Parses to Infinity, which serializes as null.
    expect(isCapAmountValid('9'.repeat(400))).toBe(false)
    expect(isCapAmountValid(String(Number.MAX_SAFE_INTEGER))).toBe(true)
  })
})

describe('convertRunRateToDryRunBasis', () => {
  // 2026-09-10 UTC; September has 30 days.
  const now = new Date('2026-09-10T12:00:00Z')

  it('converts the run-rate pair at the backend-established factor', () => {
    // Spend-status basis: 40,000 → 62,000. Dry-run counts 400 in the
    // proposed currency: factor 0.01, projected 620 in the same currency.
    expect(convertRunRateToDryRunBasis(40_000, 62_000, 400)).toEqual({
      spendMinor: 400,
      projectedMinor: 620,
    })
  })

  it('keeps the run-rate breach a current-spend check would miss', () => {
    // The review's case: cap 60,000, current 40,000, projected 62,000.
    // `would_breach_100` (40,000 < 60,000) says no breach; the run rate
    // breaches, and the converted pair fed to the breach interpolation
    // must say so too — in whatever currency the dry-run counted in.
    const converted = convertRunRateToDryRunBasis(40_000, 62_000, 40_000)!
    expect(converted.projectedMinor).toBeGreaterThan(60_000)
    expect(
      projectedBreachDate(MONTHLY, 60_000, converted.spendMinor, converted.projectedMinor, now),
    ).toBeDefined()
  })

  it('is undefined with no basis for a factor — never an unconverted figure', () => {
    expect(convertRunRateToDryRunBasis(0, 62_000, 400)).toBeUndefined()
    expect(convertRunRateToDryRunBasis(-1, 62_000, 400)).toBeUndefined()
    expect(convertRunRateToDryRunBasis(40_000, 62_000, -5)).toBeUndefined()
    expect(convertRunRateToDryRunBasis(40_000, Number.NaN, 400)).toBeUndefined()
  })

  it('declines when backend rounding stops being negligible — never an amplified guess', () => {
    // Review case: elapsed fraction 0.4, source spend 1, backend-rounded
    // projected 3 (true 2.5±0.5), dry-run 1,001. The naive factor gives
    // 3,003 against a backend-equivalent ~2,503: rounding alone owns 25%
    // of the growth, so the helper declines and the preview shows the
    // unavailable note instead.
    expect(convertRunRateToDryRunBasis(1, 3, 1_001)).toBeUndefined()
    // Near-flat run rate: ±0.5 on a growth of 10 could move the breach
    // date materially, so this declines too…
    expect(convertRunRateToDryRunBasis(100_000, 100_010, 100_000)).toBeUndefined()
    // …while a growth of 25 — rounding exactly a 2% share — still converts.
    expect(convertRunRateToDryRunBasis(1_000, 1_025, 1_000)).toEqual({
      spendMinor: 1_000,
      projectedMinor: 1_025,
    })
  })

  it('declines a flat or negative rounded growth — it can hide a boundary breach', () => {
    // Review case: spend and projected both round to 26, dry-run 2,600 at
    // true elapsed fraction 0.9815 — backend-equivalent projection ~2,649,
    // so a 2,625 cap breaches while the naive conversion prints 2,600 and
    // reports no breach. Only a backend-provided converted projection could
    // decide this boundary.
    expect(convertRunRateToDryRunBasis(26, 26, 2_600)).toBeUndefined()
    expect(convertRunRateToDryRunBasis(40_000, 40_000, 400)).toBeUndefined()
    expect(convertRunRateToDryRunBasis(40_000, 39_000, 400)).toBeUndefined()
  })
})

describe('thresholdActionFor', () => {
  const actions = { threshold_80: 'notify', threshold_100: 'pause' }

  it('renders the reached threshold — 80% notifies even on an auto-pause cap', () => {
    expect(thresholdActionFor(80, actions)).toBe('notify')
    expect(thresholdActionFor(99.9, actions)).toBe('notify')
    expect(thresholdActionFor(100, actions)).toBe('pause')
    expect(thresholdActionFor(240, actions)).toBe('pause')
  })

  it('renders no action below the first threshold or without a percentage', () => {
    expect(thresholdActionFor(79.9, actions)).toBeUndefined()
    expect(thresholdActionFor(null, actions)).toBeUndefined()
    expect(thresholdActionFor(undefined, actions)).toBeUndefined()
  })
})

function spendItem(overrides: Partial<SpendStatusItem> = {}): SpendStatusItem {
  const money = (minor: number) => ({ amount_minor: minor, currency: 'JPY' })
  return {
    scope: 'tenant',
    period: 'monthly',
    cap: null,
    spend_to_date: money(4_000),
    settled_spend: money(3_000),
    provisional_spend: money(1_000),
    projected_spend: money(6_000),
    percentage: 40,
    data_freshness: {
      is_stale: false,
      is_settled: true,
      lag_hours: 1,
      last_synced_at: '2026-09-10T00:00:00Z',
    },
    actions_configured: {
      auto_pause: false,
      auto_resume_on_rollover: false,
      threshold_80: 'notify',
      threshold_100: 'notify',
    },
    ...overrides,
  }
}

describe('freshnessFacts', () => {
  it('exposes the backend freshness flags and the provisional tail', () => {
    const facts = freshnessFacts(spendItem())
    expect(facts.stale).toBe(false)
    expect(facts.settled).toBe(true)
    expect(facts.provisionalMinor).toBe(1_000)
    expect(facts.lastSyncedAt).toBe('2026-09-10T00:00:00Z')
  })

  it('marks stale data stale — figures never render plain', () => {
    const facts = freshnessFacts(
      spendItem({
        data_freshness: {
          is_stale: true,
          is_settled: false,
          lag_hours: 30,
          last_synced_at: '2026-09-08T00:00:00Z',
        },
      }),
    )
    expect(facts.stale).toBe(true)
    expect(facts.lagHours).toBe(30)
  })

  it('never reports a negative provisional tail', () => {
    const facts = freshnessFacts(
      spendItem({
        spend_to_date: { amount_minor: 100, currency: 'JPY' },
        settled_spend: { amount_minor: 300, currency: 'JPY' },
      }),
    )
    expect(facts.provisionalMinor).toBe(0)
  })
})
