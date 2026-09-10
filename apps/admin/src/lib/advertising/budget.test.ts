import type { SpendStatusItem } from '@sanvi/api-client'
import { BUDGET_PERIOD_DAILY as DAILY, BUDGET_PERIOD_MONTHLY as MONTHLY } from '../budget-periods'
import { describe, expect, it } from 'vitest'
import {
  capDeltaRows,
  capStatusFor,
  freshnessFacts,
  projectedBreachDate,
  scopeCampaignId,
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

  it('interpolates the breach day inside the month for a monthly cap', () => {
    // Spend 300k, projected 900k: cap 600k is growth's midpoint — half of
    // September (15 days) after its start → Sep 16 00:00 UTC.
    const projection = projectedBreachDate(MONTHLY, 600_000, 300_000, 900_000, now)
    expect(projection?.date).toBe('2026-09-16')
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
