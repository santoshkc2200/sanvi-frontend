import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import RetentionReportView from '../src/RetentionReportView.svelte'
import type { RetentionClassRow } from '../src/RetentionReportView.svelte'

/**
 * The retention report view (TASK-028): per-class status from the backend's
 * live report — rule, last run, rows affected, oldest surviving row — with a
 * stalled executor class visibly flagged. The component is data-driven (ui
 * never imports the data layer) so TASK-029's evidence surfaces reuse it.
 */

const LIVE: RetentionClassRow = {
  dataClass: 'consent_record',
  sensitivity: 'sensitive',
  basis: 'consent',
  periodDays: 1095,
  action: 'delete',
  enforcement: 'executor:privacy.retention_sweep',
  executor: 'privacy.retention_sweep',
  lastRun: {
    runAt: '2026-10-13T22:00:00Z',
    action: 'delete',
    rowsAffected: 12,
    executor: 'privacy.retention_sweep',
  },
  oldestSurvivingRow: '2026-01-01T00:00:00Z',
  stalled: false,
}

const STALLED: RetentionClassRow = {
  dataClass: 'invoice',
  sensitivity: 'confidential',
  basis: undefined,
  periodDays: 3650,
  action: 'archive',
  enforcement: 'executor:platform.archival_sweep',
  executor: 'platform.archival_sweep',
  lastRun: {
    runAt: '2026-09-01T00:00:00Z',
    action: 'archive',
    rowsAffected: 3,
    executor: 'platform.archival_sweep',
  },
  oldestSurvivingRow: '2016-10-14T00:00:00Z',
  stalled: true,
}

const BY_CONSTRUCTION: RetentionClassRow = {
  dataClass: 'audit_log',
  sensitivity: 'confidential',
  basis: undefined,
  periodDays: 365,
  action: 'archive',
  enforcement: 'by-construction (append-only grants guarantee the minimum window)',
  executor: undefined,
  lastRun: undefined,
  oldestSurvivingRow: undefined,
  stalled: undefined,
}

describe('RetentionReportView (TASK-028)', () => {
  it('renders every class with rule, last run, rows affected, and oldest surviving row', () => {
    render(RetentionReportView, {
      props: {
        generatedAtLabel: 'Generated 14 Oct 2026, 00:00',
        stalenessLabel: 'Staleness window: 48 hours',
        ruleHeader: 'Rule',
        lastRunHeader: 'Last run',
        oldestHeader: 'Oldest surviving row',
        classHeader: 'Class',
        statusHeader: 'Status',
        statusOkLabel: 'Ran inside window',
        classes: [LIVE],
      },
    })

    const table = screen.getByRole('table')
    expect(table).toBeInTheDocument()
    expect(table.textContent).toContain('consent_record')
    // The rule: period + action.
    expect(table.textContent).toContain('1095')
    expect(table.textContent).toContain('delete')
    // The last run names its rows affected — the run is a fact, not a promise.
    expect(table.textContent).toContain('12')
    // The oldest surviving row's year is present.
    expect(table.textContent).toContain('2026')
  })

  it('visibly flags a class that has not run inside its window — words and a marker, not colour alone', () => {
    render(RetentionReportView, {
      props: {
        stalledBannerTitle: 'Classes past their staleness window',
        stalledBannerBody: 'These executor-backed classes have not run inside their window.',
        classes: [LIVE, STALLED],
      },
    })

    const flag = document.querySelector('[data-retention="stalled"]')
    expect(flag).not.toBeNull()
    expect(flag?.textContent).toMatch(/past window|stalled/i)
    // The banner names the stalled classes too.
    expect(screen.getByText(/Classes past their staleness window/)).toBeInTheDocument()
  })

  it('reports non-executor classes as facts — who enforces this, honestly', () => {
    render(RetentionReportView, {
      props: {
        noRunLabel: 'No scheduled run',
        classes: [BY_CONSTRUCTION],
      },
    })
    const table = screen.getByRole('table')
    expect(table.textContent).toContain('audit_log')
    expect(table.textContent).toContain('by-construction')
    expect(table.textContent).toMatch(/no scheduled run/i)
  })

  it('has no accessibility violations with a stalled class flagged', async () => {
    const { container } = render(RetentionReportView, {
      props: {
        generatedAtLabel: 'Generated 14 Oct 2026, 00:00',
        stalledBannerTitle: 'Classes past their staleness window',
        stalledBannerBody: 'These classes have not run inside their window.',
        classes: [LIVE, STALLED, BY_CONSTRUCTION],
      },
    })
    expect(await axe(container)).toHaveNoViolations()
  })

  it('composes the rule and last-run fragments from injected labels — no hardcoded English', () => {
    render(RetentionReportView, {
      props: {
        ruleDaysSuffix: '日',
        lastRunRowsLabel: '行',
        classes: [LIVE],
      },
    })
    const table = screen.getByRole('table')
    expect(table.textContent).toContain('1095日')
    expect(table.textContent).toContain('delete')
    expect(table.textContent).toContain('12 行')
    expect(table.textContent).not.toContain('1095d')
    expect(table.textContent).not.toContain('12 rows')
  })
})
