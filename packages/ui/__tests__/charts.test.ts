import { axe } from '@sanvi/test-config/axe'
import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import BarChart from '../src/charts/BarChart.svelte'
import ChartDataTable from '../src/charts/ChartDataTable.svelte'
import LineChart from '../src/charts/LineChart.svelte'
import OverlayChart from '../src/charts/OverlayChart.svelte'
import Sparkline from '../src/charts/Sparkline.svelte'
import StackedBarChart from '../src/charts/StackedBarChart.svelte'
import { niceTicks, thinLabels, xAt } from '../src/charts/math'

const TABLE_LABELS = {
  dataTable: 'View as data table',
  caption: 'Spend by day',
  categoryHeader: 'Date',
  flagHeader: 'Status',
}

const frameLabels = { ...TABLE_LABELS, empty: 'No data for this range', summary: 'Daily spend' }

const CATEGORIES = ['Aug 1', 'Aug 2', 'Aug 3']
const SERIES = [
  { key: 'spend', label: 'Spend', values: [100, 200, null] },
  { key: 'revenue', label: 'Revenue', values: [0, 350, 150] },
]

describe('LineChart', () => {
  it('renders legend entries and thinned axis labels from the data', () => {
    render(LineChart, { props: { categories: CATEGORIES, series: SERIES, labels: frameLabels } })
    // Series names appear in the legend and the table header, dates in the
    // axis and the table rows — each text exists at least twice.
    expect(screen.getAllByText('Spend').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Revenue').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Aug 1').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Aug 3').length).toBeGreaterThan(0)
  })

  it('renders the labelled empty state instead of a frame for empty data', () => {
    render(LineChart, {
      props: { categories: [], series: SERIES, labels: frameLabels },
    })
    expect(screen.getByText('No data for this range')).toBeInTheDocument()
    expect(screen.queryByText('View as data table')).not.toBeInTheDocument()
  })

  it('renders a single point without a degenerate path', () => {
    const { container } = render(LineChart, {
      props: {
        categories: ['Aug 1'],
        series: [{ key: 'spend', label: 'Spend', values: [500] }],
        labels: frameLabels,
      },
    })
    expect(container.querySelector('circle')).not.toBeNull()
    expect(container.querySelector('path[d]')).toBeNull()
  })

  it('renders dense data without per-point markers or labels beyond the thin set', () => {
    const dense = Array.from({ length: 60 }, (_, i) => `Day ${i + 1}`)
    const { container } = render(LineChart, {
      props: {
        categories: dense,
        series: [{ key: 'spend', label: 'Spend', values: dense.map((_, i) => i) }],
        labels: frameLabels,
      },
    })
    expect(container.querySelectorAll('path[d]').length).toBeGreaterThan(0)
    // Thinned x labels: far fewer text labels than 60 categories.
    const texts = container.querySelectorAll('svg text')
    expect(texts.length).toBeLessThan(30)
  })

  it('marks flagged categories with a glyph and the table column, not colour alone', () => {
    const { container } = render(LineChart, {
      props: {
        categories: CATEGORIES,
        series: [SERIES[0]!],
        labels: frameLabels,
        flags: [null, 'Still updating', null],
      },
    })
    const title = container.querySelector('svg title')
    expect(title?.textContent).toContain('Still updating')
    // In the flag note and the table's flag column.
    expect(screen.getAllByText('Still updating').length).toBeGreaterThanOrEqual(2)
  })

  it('ships the accessible data table from the same props', async () => {
    const { container } = render(LineChart, {
      props: { categories: CATEGORIES, series: SERIES, labels: frameLabels },
    })
    const details = container.querySelector('details')
    expect(details).not.toBeNull()
    if (details) details.open = true
    expect(screen.getByText('View as data table')).toBeInTheDocument()
    expect(await screen.findByText('Spend by day')).toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = render(LineChart, {
      props: {
        categories: CATEGORIES,
        series: SERIES,
        labels: frameLabels,
        flags: [null, 'Still updating', null],
      },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('BarChart', () => {
  it('draws one rect per measured (non-null) value', () => {
    const { container } = render(BarChart, {
      props: { categories: CATEGORIES, series: SERIES, labels: frameLabels },
    })
    // spend: 2 measured; revenue: 3 measured → 5 rects.
    expect(container.querySelectorAll('svg rect').length).toBe(5)
  })

  it('renders the labelled empty state for empty data', () => {
    render(BarChart, { props: { categories: [], series: SERIES, labels: frameLabels } })
    expect(screen.getByText('No data for this range')).toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = render(BarChart, {
      props: { categories: CATEGORIES, series: SERIES, labels: frameLabels },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('StackedBarChart', () => {
  it('stacks each series segment with its own hatch pattern', () => {
    const { container } = render(StackedBarChart, {
      props: { categories: CATEGORIES, series: SERIES, labels: frameLabels },
    })
    const patterns = container.querySelectorAll('pattern')
    expect(patterns.length).toBe(2)
    // Data rects only (legend swatches render their own): Aug 1 = 1 segment
    // (zero revenue renders nothing), Aug 2 = 2 stacked, Aug 3 = 1.
    const chart = container.querySelector('svg.sanvi-stacked-bar__svg')!
    expect(chart.querySelectorAll('rect[fill^="url"]').length).toBe(4)
  })

  it('has no axe violations', async () => {
    const { container } = render(StackedBarChart, {
      props: { categories: CATEGORIES, series: SERIES, labels: frameLabels },
    })
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('Sparkline', () => {
  it('is a labelled image, never an unlabelled decoration', async () => {
    const { container } = render(Sparkline, {
      props: { values: [1, 2, 3, 2.5], label: 'Spend, last 30 days' },
    })
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('role')).toBe('img')
    expect(svg?.getAttribute('aria-label')).toBe('Spend, last 30 days')
    expect(await axe(container)).toHaveNoViolations()
  })

  it('skips null gaps without dipping to zero', () => {
    const { container } = render(Sparkline, {
      props: { values: [1, null, 3], label: 'trend' },
    })
    expect(container.querySelectorAll('path').length).toBe(2)
  })
})

describe('ChartDataTable', () => {
  it('renders one row per category, one column per series, em dashes for nulls', () => {
    render(ChartDataTable, {
      props: {
        categories: CATEGORIES,
        series: SERIES,
        valueFormat: (value) => `¥${value}`,
        labels: TABLE_LABELS,
        flags: [null, 'Still updating', null],
      },
    })
    expect(screen.getByRole('columnheader', { name: 'Date' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Spend' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument()
    expect(screen.getByText('¥200')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument() // null value
    expect(screen.getByText('Still updating')).toBeInTheDocument()
  })
})

describe('OverlayChart', () => {
  const bar = { key: 'spend', label: 'Spend', values: [100, 120, 90] }
  const lines = [
    { key: 'pv', label: 'Platform value', values: [200, null, 260] },
    { key: 'sr', label: 'Sanvi revenue', values: [180, 210, 240] },
  ]

  it('draws bars and lines with shape-differentiated legend entries', async () => {
    const { container } = render(OverlayChart, {
      props: { categories: CATEGORIES, barSeries: bar, lineSeries: lines, labels: frameLabels },
    })
    expect(container.querySelectorAll('rect').length).toBe(3)
    // Null gap splits platform value into two segments; Sanvi revenue is one.
    expect(container.querySelectorAll('path[d]').length).toBe(3)
    expect(container.querySelectorAll('svg.sanvi-overlay-chart__legend-line').length).toBe(2)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('renders the empty state when everything is null', () => {
    render(OverlayChart, {
      props: {
        categories: CATEGORIES,
        barSeries: { key: 'spend', label: 'Spend', values: [null, null, null] },
        lineSeries: lines.map((entry) => ({ ...entry, values: entry.values.map(() => null) })),
        labels: frameLabels,
      },
    })
    expect(screen.getByText('No data for this range')).toBeInTheDocument()
  })
})

describe('chart math', () => {
  it('niceTicks returns a sane axis for zero/empty maxima', () => {
    expect(niceTicks(0)).toEqual([0, 1])
    expect(niceTicks(Number.NaN)).toEqual([0, 1])
  })

  it('niceTicks covers the max with round steps', () => {
    const ticks = niceTicks(900)
    expect(ticks[0]).toBe(0)
    expect(ticks.at(-1)).toBeGreaterThanOrEqual(900)
    for (let i = 1; i < ticks.length; i += 1) {
      expect(ticks[i]! - ticks[i - 1]!).toBeGreaterThan(0)
    }
  })

  it('xAt centres a single category', () => {
    expect(xAt(0, 1, 72, 624)).toBe((72 + 624) / 2)
  })

  it('thinLabels keeps first and last', () => {
    const thinned = thinLabels(
      Array.from({ length: 30 }, (_, i) => `d${i}`),
      6,
    )
    expect(thinned[0]).toBe('d0')
    expect(thinned.at(-1)).toBe('d29')
    expect(thinned.filter(Boolean).length).toBeLessThanOrEqual(7)
  })
})
