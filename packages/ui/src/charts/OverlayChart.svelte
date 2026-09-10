<script lang="ts">
import ChartDataTable from './ChartDataTable.svelte'
import { CHART_DASH_PATTERNS, CHART_SERIES_COLORS, niceTicks, thinLabels } from './math'
import type { ChartFrameLabels, ChartSeries, ChartTableLabels } from './types'

/**
 * Spend-vs-revenue overlay (phase 10, TASK-016) — bars for one series
 * (spend), lines for the others (each revenue source), one shared axis.
 * Hand-rolled SVG on the tokenized layer; the bar/line shape difference is
 * itself a non-colour encoding, and the lines additionally carry distinct
 * dash patterns. Ships the same accessible data table as every other
 * chart, built from the same props.
 */
interface Props {
  categories: string[]
  /** Rendered as bars — the base of the overlay (spend). */
  barSeries: ChartSeries
  /** Rendered as lines over the bars (each revenue source, separately labelled). */
  lineSeries: ChartSeries[]
  /** Formats a y-axis tick; caller-localized. */
  yFormat?: (value: number) => string
  /** Formats a data-table cell; defaults to {@link yFormat}. */
  valueFormat?: (value: number) => string
  labels: ChartTableLabels & ChartFrameLabels
  /** Per-category flag text (e.g. restatement status) — marker strip + table column. */
  flags?: (string | null)[]
  class?: string
}

let {
  categories,
  barSeries,
  lineSeries,
  yFormat = String,
  valueFormat,
  labels,
  flags,
  class: className = '',
}: Props = $props()

const VB_W = 640
const VB_H = 320
const PLOT = { top: 16, right: 16, bottom: 56, left: 72 }

const plotWidth = VB_W - PLOT.left - PLOT.right
const plotHeight = VB_H - PLOT.top - PLOT.bottom

const allSeries = $derived([barSeries, ...lineSeries])

const hasData = $derived(
  categories.length > 0 &&
    allSeries.some((entry) =>
      entry.values.some((value) => value !== null && Number.isFinite(value)),
    ),
)

const maxTickSet = $derived.by(() => {
  let max = 0
  for (const entry of allSeries) {
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

function dashAt(lineIndex: number): string {
  return CHART_DASH_PATTERNS[(lineIndex + 1) % CHART_DASH_PATTERNS.length] ?? ''
}

const xLabels = $derived(thinLabels(categories, 8))

function xCenter(index: number): number {
  if (categories.length === 0) return PLOT.left
  return PLOT.left + ((index + 0.5) / categories.length) * plotWidth
}

function barWidth(): number {
  return (plotWidth / Math.max(1, categories.length)) * 0.6
}

function barLeft(index: number): number {
  return xCenter(index) - barWidth() / 2
}

function barHeight(value: number): number {
  if (!Number.isFinite(value) || value <= 0 || yMax <= 0) return 0
  return (value / yMax) * plotHeight
}

function xOf(index: number): number {
  if (categories.length <= 1) return PLOT.left + plotWidth / 2
  return PLOT.left + (index / (categories.length - 1)) * plotWidth
}

function yOf(value: number): number {
  return VB_H - PLOT.bottom - (value / yMax) * plotHeight
}

/** Path segments per line series, split on nulls — gaps, never zero dips. */
function pathFor(values: (number | null)[]): string[] {
  const segments: string[] = []
  let current = ''
  values.forEach((value, index) => {
    if (value === null || !Number.isFinite(value)) {
      if (current) segments.push(current)
      current = ''
      return
    }
    current += `${current ? 'L' : 'M'}${xOf(index).toFixed(1)},${yOf(value).toFixed(1)}`
  })
  if (current) segments.push(current)
  return segments
}

const singlePoint = $derived(categories.length === 1)

const flaggedIndexes = $derived.by(() => {
  if (!flags) return [] as number[]
  return flags.map((flag, index) => (flag ? index : -1)).filter((index) => index >= 0)
})
</script>

<div class="sanvi-overlay-chart {className}">
  {#if hasData}
    <svg
      viewBox="0 0 {VB_W} {VB_H}"
      {...(labels.summary
        ? { role: 'img', 'aria-label': labels.summary }
        : { 'aria-hidden': 'true' })}
      class="sanvi-overlay-chart__svg"
    >
      {#each maxTickSet as tick (tick)}
        {@const y = VB_H - PLOT.bottom - (tick / yMax) * plotHeight}
        <line x1={PLOT.left} y1={y} x2={VB_W - PLOT.right} y2={y} class="sanvi-overlay-chart__grid" />
        <text x={PLOT.left - 8} {y} dy="0.32em" text-anchor="end" class="sanvi-overlay-chart__tick">
          {yFormat(tick)}
        </text>
      {/each}

      {#each categories as category, index (category)}
        {@const value = barSeries.values[index] ?? null}
        {#if value !== null}
          {@const height = barHeight(value)}
          <rect
            x={barLeft(index)}
            y={VB_H - PLOT.bottom - height}
            width={barWidth()}
            height={height}
            fill={colorAt(0, barSeries)}
          >
            <title>{barSeries.label}: {yFormat(value)}</title>
          </rect>
        {/if}
        {#if xLabels[index]}
          <text
            x={xCenter(index)}
            y={VB_H - PLOT.bottom + 20}
            text-anchor="middle"
            class="sanvi-overlay-chart__tick"
          >
            {xLabels[index]}
          </text>
        {/if}
        {#if flags?.[index]}
          <text
            x={xCenter(index)}
            y={VB_H - PLOT.bottom + 38}
            text-anchor="middle"
            class="sanvi-overlay-chart__flag"
          >
            ◆<title>{flags[index]}</title>
          </text>
        {/if}
      {/each}

      {#each lineSeries as entry, lineIndex (entry.key)}
        {#if singlePoint}
          {@const value = entry.values[0] ?? null}
          {#if value !== null && Number.isFinite(value)}
            <circle
              cx={xOf(0)}
              cy={yOf(value)}
              r="4"
              fill={colorAt(lineIndex + 1, entry)}
              stroke-dasharray={dashAt(lineIndex)}
            />
          {/if}
        {:else}
          {#each pathFor(entry.values) as segment, segmentIndex (segmentIndex)}
            <path
              d={segment}
              fill="none"
              stroke={colorAt(lineIndex + 1, entry)}
              stroke-width="2"
              stroke-dasharray={dashAt(lineIndex)}
              stroke-linecap="round"
            />
          {/each}
        {/if}
      {/each}
    </svg>

    <ul class="sanvi-overlay-chart__legend">
      <li class="sanvi-overlay-chart__legend-item">
        <span
          aria-hidden="true"
          class="sanvi-overlay-chart__legend-bar"
          style="background: {colorAt(0, barSeries)}"
        ></span>
        <span>{barSeries.label}</span>
      </li>
      {#each lineSeries as entry, lineIndex (entry.key)}
        <li class="sanvi-overlay-chart__legend-item">
          <svg viewBox="0 0 24 8" aria-hidden="true" class="sanvi-overlay-chart__legend-line">
            <line
              x1="1"
              y1="4"
              x2="23"
              y2="4"
              stroke={colorAt(lineIndex + 1, entry)}
              stroke-width="2"
              stroke-dasharray={dashAt(lineIndex)}
            />
          </svg>
          <span>{entry.label}</span>
        </li>
      {/each}
    </ul>

    {#if flags?.some((flag) => flag)}
      <p class="sanvi-overlay-chart__flag-note">◆ {flags?.find((flag) => flag)}</p>
    {/if}
  {:else if labels.empty}
    <p class="sanvi-overlay-chart__empty">{labels.empty}</p>
  {/if}

  {#if hasData}
    <details class="sanvi-overlay-chart__table">
      <summary>{labels.dataTable}</summary>
      <ChartDataTable
        {categories}
        series={allSeries}
        {flags}
        valueFormat={valueFormat ?? yFormat}
        {labels}
      />
    </details>
  {/if}
</div>

<style>
  .sanvi-overlay-chart {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-overlay-chart__svg {
    inline-size: 100%;
    block-size: auto;
  }

  .sanvi-overlay-chart__grid {
    stroke: var(--sanvi-color-chart-grid);
    stroke-width: var(--sanvi-border-width-thin);
  }

  .sanvi-overlay-chart__tick {
    fill: var(--sanvi-color-text-secondary);
    font-size: var(--sanvi-font-size-xs);
  }

  .sanvi-overlay-chart__flag {
    fill: var(--sanvi-color-status-warning);
    font-size: var(--sanvi-font-size-xs);
  }

  .sanvi-overlay-chart__legend {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sanvi-spacing-2) var(--sanvi-spacing-4);
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-overlay-chart__legend-item {
    display: flex;
    align-items: center;
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-overlay-chart__legend-bar {
    display: inline-block;
    inline-size: var(--sanvi-spacing-3);
    block-size: var(--sanvi-spacing-3);
    border-radius: var(--sanvi-radius-sm);
  }

  .sanvi-overlay-chart__legend-line {
    inline-size: var(--sanvi-spacing-6);
    block-size: var(--sanvi-spacing-2);
  }

  .sanvi-overlay-chart__flag-note {
    margin: 0;
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-overlay-chart__empty {
    margin: 0;
    padding: var(--sanvi-spacing-8) var(--sanvi-spacing-4);
    border: var(--sanvi-border-width-thin) dashed var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-md);
    color: var(--sanvi-color-text-secondary);
    text-align: center;
  }

  .sanvi-overlay-chart__table summary {
    cursor: pointer;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }
</style>
