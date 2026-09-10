import { describe, expect, it } from 'vitest'
import type {
  ConnectionFreshnessView,
  ConnectionView,
  MetricPoint,
  MetricsSummaryRow,
} from '@sanvi/api-client'
import {
  campaignRows,
  chartGroups,
  daysBetween,
  distinctTimezones,
  fractionChange,
  freshnessState,
  kpiGroups,
  previousRange,
  rangeForPreset,
  ratioOf,
  toMajorUnits,
} from './metrics'

function point(overrides: Partial<MetricPoint>): MetricPoint {
  return {
    clicks: 0,
    conversion_value: { amount_minor: 0, currency: 'JPY' },
    conversions: 0,
    date: '2026-08-01',
    impressions: 0,
    restating: false,
    roas_platform: null,
    roas_sanvi: null,
    sanvi_revenue: { amount_minor: 0, currency: 'JPY' },
    spend: { amount_minor: 0, currency: 'JPY' },
    ...overrides,
  }
}

describe('date ranges', () => {
  it('covers the preset inclusively, ending today', () => {
    const range = rangeForPreset('7d', '2026-08-24')
    expect(range.from).toBe('2026-08-18')
    expect(range.to).toBe('2026-08-24')
    expect(daysBetween(range.from, range.to)).toBe(7)
  })

  it('builds an equal-length immediately-prior comparison range', () => {
    const previous = previousRange({ from: '2026-08-18', to: '2026-08-24' })
    expect(previous).toEqual({ from: '2026-08-11', to: '2026-08-17' })
  })
})

describe('money and ratios', () => {
  it('converts minor units per the currency exponent — JPY stays whole', () => {
    expect(toMajorUnits(2000, 'JPY')).toBe(2000)
    expect(toMajorUnits(1999, 'USD')).toBeCloseTo(19.99, 6)
  })

  it('ratioOf refuses zero, negative, and unmeasured sides — never a fake zero', () => {
    expect(ratioOf(100, 0)).toBeNull()
    expect(ratioOf(0, 100)).toBeNull()
    expect(ratioOf(null, 100)).toBeNull()
    expect(ratioOf(100, undefined)).toBeNull()
    expect(ratioOf(300, 100)).toBe(3)
  })

  it('fractionChange needs a positive base', () => {
    expect(fractionChange(120, 100)).toBeCloseTo(0.2)
    expect(fractionChange(120, 0)).toBeNull()
    expect(fractionChange(120, null)).toBeNull()
  })
})

describe('KPI groups', () => {
  const july: MetricsSummaryRow = {
    clicks: 80,
    conversion_value: { amount_minor: 90000, currency: 'JPY' },
    conversions: 9,
    currency: 'JPY',
    impressions: 8000,
    restating: false,
    roas_platform: 1.5,
    roas_sanvi: 1.2,
    sanvi_revenue: { amount_minor: 72000, currency: 'JPY' },
    spend: { amount_minor: 60000, currency: 'JPY' },
  }
  const august: MetricsSummaryRow = {
    ...july,
    clicks: 100,
    conversion_value: { amount_minor: 120000, currency: 'JPY' },
    conversions: 12,
    impressions: 10000,
    roas_platform: 2,
    roas_sanvi: 1.5,
    sanvi_revenue: { amount_minor: 90000, currency: 'JPY' },
    spend: { amount_minor: 60000, currency: 'JPY' },
  }
  const usd: MetricsSummaryRow = {
    ...august,
    currency: 'USD',
    conversion_value: { amount_minor: 50000, currency: 'USD' },
    sanvi_revenue: { amount_minor: 40000, currency: 'USD' },
    spend: { amount_minor: 20000, currency: 'USD' },
  }

  it('keeps one group per currency and never produces a cross-currency total', () => {
    const groups = kpiGroups([august, usd])
    expect(groups.map((group) => group.currency)).toEqual(['JPY', 'USD'])
  })

  it('pairs the previous period by currency and keeps the two ROAS fields separate', () => {
    const [group] = kpiGroups([august], [july])
    expect(group?.previous?.spendMinor).toBe(60000)
    expect(group?.current.roasPlatform).toBe(2)
    expect(group?.current.roasSanvi).toBe(1.5)
  })

  it('recomputes a missing platform ROAS from the platform conversion value, never from Sanvi revenue', () => {
    const row = { ...august, roas_platform: null }
    const [group] = kpiGroups([row])
    // 120000 / 60000 — from platform conversion value, not the 90000 Sanvi figure.
    expect(group?.current.roasPlatform).toBe(2)
  })

  it('renders null ROAS rather than a lie when spend is zero', () => {
    const row = {
      ...august,
      spend: { amount_minor: 0, currency: 'JPY' },
      roas_platform: null,
      roas_sanvi: null,
    }
    const [group] = kpiGroups([row])
    expect(group?.current.roasPlatform).toBeNull()
    expect(group?.current.roasSanvi).toBeNull()
  })
})

describe('chart groups', () => {
  it('groups by currency — two accounts in two currencies make two groups, no blend', () => {
    const rows = [
      point({ date: '2026-08-01', spend: { amount_minor: 100, currency: 'JPY' } }),
      point({ date: '2026-08-01', spend: { amount_minor: 5000, currency: 'USD' } }),
    ]
    const groups = chartGroups(rows)
    expect(groups.map((group) => group.currency)).toEqual(['JPY', 'USD'])
  })

  it('sums per day within one currency and converts to major units', () => {
    const rows = [
      point({ date: '2026-08-02', spend: { amount_minor: 1500, currency: 'JPY' } }),
      point({
        date: '2026-08-02',
        platform: 'other',
        spend: { amount_minor: 500, currency: 'JPY' },
      }),
      point({ date: '2026-08-01', spend: { amount_minor: 1000, currency: 'JPY' } }),
    ]
    const [group] = chartGroups(rows)
    expect(group?.dates).toEqual(['2026-08-01', '2026-08-02'])
    expect(group?.spend).toEqual([1000, 2000])
    expect(group?.platformSpend.map((series) => series.key).sort()).toEqual(['', 'other'])
    expect(group?.hasSpend).toBe(true)
  })

  it('marks restating days and reports hasSpend=false for all-zero ranges', () => {
    const rows = [point({ date: '2026-08-01', restating: true }), point({ date: '2026-08-02' })]
    const [group] = chartGroups(rows)
    expect(group?.restating).toEqual([true, false])
    expect(group?.hasSpend).toBe(false)
  })
})

describe('campaign breakdown rows', () => {
  it('aggregates per campaign, keeping currencies and both ROAS fields separate', () => {
    const rows = [
      point({
        campaign_id: 'c1',
        date: '2026-08-01',
        spend: { amount_minor: 1000, currency: 'JPY' },
        conversion_value: { amount_minor: 3000, currency: 'JPY' },
        sanvi_revenue: { amount_minor: 2000, currency: 'JPY' },
        clicks: 10,
        impressions: 100,
        conversions: 2,
        restating: true,
      }),
      point({
        campaign_id: 'c1',
        date: '2026-08-02',
        spend: { amount_minor: 1000, currency: 'JPY' },
        conversion_value: { amount_minor: 2000, currency: 'JPY' },
        sanvi_revenue: { amount_minor: 1000, currency: 'JPY' },
        clicks: 5,
        impressions: 50,
        conversions: 1,
      }),
    ]
    const [row] = campaignRows(rows)
    expect(row?.spendMinor).toBe(2000)
    expect(row?.platformValueMinor).toBe(5000)
    expect(row?.sanviRevenueMinor).toBe(3000)
    expect(row?.clicks).toBe(15)
    expect(row?.conversions).toBe(3)
    expect(row?.restating).toBe(true)
    // Platform ROAS from platform value (5000/2000 = 2.5); Sanvi ROAS separate (3000/2000 = 1.5).
    expect(row?.roasPlatform).toBeCloseTo(2.5)
    expect(row?.roasSanvi).toBeCloseTo(1.5)
  })

  it('skips rows without a campaign id (tenant-grain rows are not campaign rows)', () => {
    expect(campaignRows([point({})])).toEqual([])
  })
})

describe('freshness and timezones', () => {
  const ok: ConnectionFreshnessView = {
    connection_id: 'a',
    platform: 'p1',
    last_ingested_at: '2026-08-24T00:00:00Z',
    lag_hours: 1,
    stalled: false,
  }
  const stalled: ConnectionFreshnessView = { connection_id: 'b', platform: 'p2', stalled: true }
  const pending: ConnectionFreshnessView = {
    connection_id: 'c',
    platform: 'p3',
    stalled: false,
  }

  it('partitions on the backend’s stalled flag, never on clock arithmetic', () => {
    const view = freshnessState([ok, stalled, pending])
    expect(view.current).toEqual([ok])
    expect(view.stalled).toEqual([stalled])
    expect(view.pending).toEqual([pending])
    expect(view.anyStalled).toBe(true)
  })

  it('states distinct timezones instead of reconciling them', () => {
    const connections = [
      { timezone: 'Asia/Tokyo' },
      { timezone: 'America/New_York' },
      { timezone: 'Asia/Tokyo' },
    ] as ConnectionView[]
    expect(distinctTimezones(connections)).toEqual(['America/New_York', 'Asia/Tokyo'])
  })
})
