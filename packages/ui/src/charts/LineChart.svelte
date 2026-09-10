<script lang="ts">
import ChartDataTable from './ChartDataTable.svelte'
import {
  CHART_DASH_PATTERNS,
  CHART_SERIES_COLORS,
  niceTicks,
  thinLabels,
  xAt,
  yFraction,
} from './math'
import type { ChartFrameLabels, ChartSeries, ChartTableLabels } from './types'

/**
 * Line chart (phase 10, TASK-016) — multi-series, hand-rolled SVG on the
 * tokenized layer: no chart library, no second design system, no bundle
 * weight. Series differ by colour *and* dash pattern (WCAG 1.4.1); every
 * instance ships the accessible data table built from the same props.
 *
 * Handles the three data shapes the acceptance criteria name: empty (a
 * labelled empty state, never a blank frame), single-point (a centred
 * marker, not a degenerate path), and dense (unboken polylines, thinned
 * axis labels).
 */
interface Props {
  categories: string[]
  series: ChartSeries[]
  /** Formats a y-axis tick; caller-localized. */
  yFormat?: (value: number) => string
  /**
   * Formats a data-table cell; defaults to {@link yFormat}. Caller-localized
   * exact money — tick labels may compact, table cells may not.
   */
  valueFormat?: (value: number) => string
  labels: ChartTableLabels & ChartFrameLabels
  /** Per-category flag text (e.g. restatement status) — marker strip + table column. */
  flags?: (string | null)[]
  class?: string
}

let {
  categories,
  series,
  yFormat = String,
  valueFormat,
  labels,
  flags,
  class: className = '',
}: Props = $props()

const cellFormat = $derived(valueFormat ?? yFormat)

const VB_W = 640
const VB_H = 320
const PLOT = { top: 16, right: 16, bottom: 56, left: 72 }

const hasData = $derived(
  categories.length > 0 &&
    series.some((entry) => entry.values.some((value) => value !== null && Number.isFinite(value))),
)

const maxTickSet = $derived.by(() => {
  let max = 0
  for (const entry of series) {
    for (const value of entry.values) {
      if (value !== null && Number.isFinite(value) && value > max) max = value
    }
  }
  return niceTicks(max)
})

const yMax = $derived(maxTickSet[maxTickSet.length - 1] ?? 1)

function colorAt(index: number, entry: ChartSeries): string {
  return (
    entry.color ?? CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length] ?? CHART_SERIES_COLORS[0]
  )
}

function dashAt(index: number): string {
  return CHART_DASH_PATTERNS[index % CHART_DASH_PATTERNS.length] ?? ''
}

function xOf(index: number): number {
  return xAt(index, categories.length, PLOT.left, VB_W - PLOT.right)
}

function yOf(value: number): number {
  return VB_H - PLOT.bottom - yFraction(value, yMax) * (VB_H - PLOT.top - PLOT.bottom)
}

/** Path segments, split on nulls so unmeasured days are gaps, not zero dips. */
function pathFor(values: (number | null)[]): string[] {
  const segments: string[] = []
  let current = ''
  values.forEach((value, index) => {
    if (value === null || !Number.isFinite(value)) {
      if (current) segments.push(current)
      current = ''
      return
    }
    const command = current ? 'L' : 'M'
    current += `${command}${xOf(index).toFixed(1)},${yOf(value).toFixed(1)}`
  })
  if (current) segments.push(current)
  return segments
}

const xLabels = $derived(thinLabels(categories, 8))

const singlePoint = $derived(categories.length === 1)

// Restatement flags get a marker strip under the plot: a glyph in the flag
// position, labelled in words via <title> and in the data table — never a
// bare colour change.
const flaggedIndexes = $derived.by(() => {
  if (!flags) return [] as number[]
  return flags.map((flag, index) => (flag ? index : -1)).filter((index) => index >= 0)
})
</script>

<div class="sanvi-line-chart {className}">
  {#if hasData}
    <svg
      viewBox="0 0 {VB_W} {VB_H}"
      {...(labels.summary
        ? { role: 'img', 'aria-label': labels.summary }
        : { 'aria-hidden': 'true' })}
      class="sanvi-line-chart__svg"
    >
      <!-- y gridlines + tick labels -->
      {#each maxTickSet as tick (tick)}
        {@const y = yOf(tick)}
        <line
          x1={PLOT.left}
          y1={y}
          x2={VB_W - PLOT.right}
          y2={y}
          class="sanvi-line-chart__grid"
        />
        <text x={PLOT.left - 8} {y} dy="0.32em" text-anchor="end" class="sanvi-line-chart__tick">
          {yFormat(tick)}
        </text>
      {/each}

      <!-- x axis labels, thinned -->
      {#each xLabels as label, index (index)}
        {#if label}
          <text
            x={xOf(index)}
            y={VB_H - PLOT.bottom + 20}
            text-anchor="middle"
            class="sanvi-line-chart__tick"
          >
            {label}
          </text>
        {/if}
      {/each}

      <!-- restatement flag markers -->
      {#each flaggedIndexes as index (index)}
        <text
          x={xOf(index)}
          y={VB_H - PLOT.bottom + 38}
          text-anchor="middle"
          class="sanvi-line-chart__flag"
        >
          ◆<title>{flags?.[index]}</title>
        </text>
      {/each}

      {#each series as entry, seriesIndex (entry.key)}
        {#if singlePoint}
          {@const value = entry.values[0] ?? null}
          {#if value !== null && Number.isFinite(value)}
            <circle
              cx={xOf(0)}
              cy={yOf(value)}
              r="4"
              fill={colorAt(seriesIndex, entry)}
              stroke={dashAt(seriesIndex) ? 'var(--sanvi-color-background-primary)' : 'none'}
              stroke-width={dashAt(seriesIndex) ? 2 : 0}
              stroke-dasharray={dashAt(seriesIndex)}
            />
          {/if}
        {:else}
          {#each pathFor(entry.values) as segment, segmentIndex (segmentIndex)}
            <path
              d={segment}
              fill="none"
              stroke={colorAt(seriesIndex, entry)}
              stroke-width="2"
              stroke-dasharray={dashAt(seriesIndex)}
              stroke-linecap="round"
            />
          {/each}
        {/if}
      {/each}
    </svg>

    <ul class="sanvi-line-chart__legend">
      {#each series as entry, seriesIndex (entry.key)}
        <li class="sanvi-line-chart__legend-item">
          <svg
            viewBox="0 0 24 8"
            aria-hidden="true"
            class="sanvi-line-chart__legend-swatch"
          >
            <line
              x1="1"
              y1="4"
              x2="23"
              y2="4"
              stroke={colorAt(seriesIndex, entry)}
              stroke-width="2"
              stroke-dasharray={dashAt(seriesIndex)}
            />
          </svg>
          <span>{entry.label}</span>
        </li>
      {/each}
    </ul>

    {#if flags?.some((flag) => flag)}
      <p class="sanvi-line-chart__flag-note">◆ {flags?.find((flag) => flag)}</p>
    {/if}
  {:else if labels.empty}
    <p class="sanvi-line-chart__empty">{labels.empty}</p>
  {/if}

  {#if hasData}
    <details class="sanvi-line-chart__table">
      <summary>{labels.dataTable}</summary>
      <ChartDataTable {categories} {series} {flags} valueFormat={cellFormat} {labels} />
    </details>
  {/if}
</div>

<style>
  .sanvi-line-chart {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-line-chart__svg {
    inline-size: 100%;
    block-size: auto;
  }

  .sanvi-line-chart__grid {
    stroke: var(--sanvi-color-chart-grid);
    stroke-width: var(--sanvi-border-width-thin);
  }

  .sanvi-line-chart__tick {
    fill: var(--sanvi-color-text-secondary);
    font-size: var(--sanvi-font-size-xs);
  }

  .sanvi-line-chart__flag {
    fill: var(--sanvi-color-status-warning);
    font-size: var(--sanvi-font-size-xs);
  }

  .sanvi-line-chart__legend {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sanvi-spacing-2) var(--sanvi-spacing-4);
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-line-chart__legend-item {
    display: flex;
    align-items: center;
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-line-chart__legend-swatch {
    inline-size: var(--sanvi-spacing-6);
    block-size: var(--sanvi-spacing-2);
  }

  .sanvi-line-chart__flag-note {
    margin: 0;
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-line-chart__empty {
    margin: 0;
    padding: var(--sanvi-spacing-8) var(--sanvi-spacing-4);
    border: var(--sanvi-border-width-thin) dashed var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-md);
    color: var(--sanvi-color-text-secondary);
    text-align: center;
  }

  .sanvi-line-chart__table summary {
    cursor: pointer;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }
</style>
