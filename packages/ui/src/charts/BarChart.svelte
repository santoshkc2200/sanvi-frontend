<script lang="ts">
import ChartDataTable from './ChartDataTable.svelte'
import { CHART_SERIES_COLORS, niceTicks, thinLabels } from './math'
import type { ChartFrameLabels, ChartSeries, ChartTableLabels } from './types'

/**
 * Grouped bar chart (phase 10, TASK-016) — vertical bars, one slot per
 * series within each category, hand-rolled SVG on the tokenized layer.
 * Zero renders as a zero-height bar on the baseline (a real measured
 * zero); `null` renders no bar at all (unmeasured) — the distinction the
 * table's em dash carries too.
 */
interface Props {
  categories: string[]
  series: ChartSeries[]
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

const plotWidth = VB_W - PLOT.left - PLOT.right
const plotHeight = VB_H - PLOT.top - PLOT.bottom

function colorAt(index: number, entry: ChartSeries): string {
  return (
    entry.color ?? CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length] ?? CHART_SERIES_COLORS[0]
  )
}

const xLabels = $derived(thinLabels(categories, 8))

function xCenter(index: number): number {
  if (categories.length === 0) return PLOT.left
  return PLOT.left + ((index + 0.5) / categories.length) * plotWidth
}

/** Geometry for one category's series slots. */
function barGeometry(categoryIndex: number) {
  const slotWidth = plotWidth / Math.max(1, categories.length)
  const groupWidth = slotWidth * 0.7
  const barWidth = groupWidth / series.length
  const groupLeft = PLOT.left + categoryIndex * slotWidth + (slotWidth - groupWidth) / 2
  return { barWidth, groupLeft }
}

function barHeight(value: number | null): number {
  if (value === null || !Number.isFinite(value) || value <= 0 || yMax <= 0) return 0
  return (value / yMax) * plotHeight
}

const flaggedIndexes = $derived.by(() => {
  if (!flags) return [] as number[]
  return flags.map((flag, index) => (flag ? index : -1)).filter((index) => index >= 0)
})
</script>

<div class="sanvi-bar-chart {className}">
  {#if hasData}
    <svg
      viewBox="0 0 {VB_W} {VB_H}"
      {...(labels.summary
        ? { role: 'img', 'aria-label': labels.summary }
        : { 'aria-hidden': 'true' })}
      class="sanvi-bar-chart__svg"
    >
      {#each maxTickSet as tick (tick)}
        {@const y = VB_H - PLOT.bottom - (tick / yMax) * plotHeight}
        <line x1={PLOT.left} y1={y} x2={VB_W - PLOT.right} y2={y} class="sanvi-bar-chart__grid" />
        <text x={PLOT.left - 8} {y} dy="0.32em" text-anchor="end" class="sanvi-bar-chart__tick">
          {yFormat(tick)}
        </text>
      {/each}

      {#each categories as category, index (category)}
        {@const { barWidth, groupLeft } = barGeometry(index)}
        {#each series as entry, seriesIndex (entry.key)}
          {@const value = entry.values[index] ?? null}
          {@const height = barHeight(value)}
          {@const x = groupLeft + seriesIndex * barWidth}
          {#if value !== null}
            <rect
              {x}
              y={VB_H - PLOT.bottom - height}
              width={Math.max(0, barWidth - 2)}
              height={height}
              fill={colorAt(seriesIndex, entry)}
            >
              <title>{entry.label}: {yFormat(value)}</title>
            </rect>
          {/if}
        {/each}
        {#if xLabels[index]}
          <text
            x={xCenter(index)}
            y={VB_H - PLOT.bottom + 20}
            text-anchor="middle"
            class="sanvi-bar-chart__tick"
          >
            {xLabels[index]}
          </text>
        {/if}
        {#if flags?.[index]}
          <text
            x={xCenter(index)}
            y={VB_H - PLOT.bottom + 38}
            text-anchor="middle"
            class="sanvi-bar-chart__flag"
          >
            ◆<title>{flags[index]}</title>
          </text>
        {/if}
      {/each}
    </svg>

    <ul class="sanvi-bar-chart__legend">
      {#each series as entry, seriesIndex (entry.key)}
        <li class="sanvi-bar-chart__legend-item">
          <span
            aria-hidden="true"
            class="sanvi-bar-chart__legend-swatch"
            style="background: {colorAt(seriesIndex, entry)}"
          ></span>
          <span>{entry.label}</span>
        </li>
      {/each}
    </ul>

    {#if flags?.some((flag) => flag)}
      <p class="sanvi-bar-chart__flag-note">◆ {flags?.find((flag) => flag)}</p>
    {/if}
  {:else if labels.empty}
    <p class="sanvi-bar-chart__empty">{labels.empty}</p>
  {/if}

  {#if hasData}
    <details class="sanvi-bar-chart__table">
      <summary>{labels.dataTable}</summary>
      <ChartDataTable {categories} {series} {flags} valueFormat={cellFormat} {labels} />
    </details>
  {/if}
</div>

<style>
  .sanvi-bar-chart {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-bar-chart__svg {
    inline-size: 100%;
    block-size: auto;
  }

  .sanvi-bar-chart__grid {
    stroke: var(--sanvi-color-chart-grid);
    stroke-width: var(--sanvi-border-width-thin);
  }

  .sanvi-bar-chart__tick {
    fill: var(--sanvi-color-text-secondary);
    font-size: var(--sanvi-font-size-xs);
  }

  .sanvi-bar-chart__flag {
    fill: var(--sanvi-color-status-warning);
    font-size: var(--sanvi-font-size-xs);
  }

  .sanvi-bar-chart__legend {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sanvi-spacing-2) var(--sanvi-spacing-4);
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-bar-chart__legend-item {
    display: flex;
    align-items: center;
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-bar-chart__legend-swatch {
    display: inline-block;
    inline-size: var(--sanvi-spacing-3);
    block-size: var(--sanvi-spacing-3);
    border-radius: var(--sanvi-radius-sm);
  }

  .sanvi-bar-chart__flag-note {
    margin: 0;
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-bar-chart__empty {
    margin: 0;
    padding: var(--sanvi-spacing-8) var(--sanvi-spacing-4);
    border: var(--sanvi-border-width-thin) dashed var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-md);
    color: var(--sanvi-color-text-secondary);
    text-align: center;
  }

  .sanvi-bar-chart__table summary {
    cursor: pointer;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }
</style>
