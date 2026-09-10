<script lang="ts">
import ChartDataTable from './ChartDataTable.svelte'
import { CHART_SERIES_COLORS, hatchRotation, niceTicks, thinLabels } from './math'
import type { ChartFrameLabels, ChartSeries, ChartTableLabels } from './types'

/**
 * Stacked bar chart (phase 10, TASK-016) — per-category stacks (e.g. spend
 * by platform per day), hand-rolled SVG on the tokenized layer. Each
 * series' fill carries a hatch pattern at its own rotation as well as its
 * colour, so stacked segments never differ by hue alone (WCAG 1.4.1); the
 * accessible data table ships the exact values.
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

// Scopes the hatch pattern IDs to this chart instance — two currency charts
// on one page share platform keys, and bare `sanvi-hatch-<key>` IDs collide
// across documents, letting a later chart reference an earlier chart's
// pattern (wrong colour/hatch when platform subsets differ).
const uid = $props.id()

const cellFormat = $derived(valueFormat ?? yFormat)

const VB_W = 640
const VB_H = 320
const PLOT = { top: 16, right: 16, bottom: 56, left: 72 }

const plotWidth = VB_W - PLOT.left - PLOT.right
const plotHeight = VB_H - PLOT.top - PLOT.bottom

const hasData = $derived(
  categories.length > 0 &&
    series.some((entry) => entry.values.some((value) => value !== null && Number.isFinite(value))),
)

const maxTickSet = $derived.by(() => {
  let max = 0
  for (let index = 0; index < categories.length; index += 1) {
    let stackTotal = 0
    for (const entry of series) {
      const value = entry.values[index] ?? null
      if (value !== null && Number.isFinite(value)) stackTotal += value
    }
    if (stackTotal > max) max = stackTotal
  }
  return niceTicks(max)
})

const yMax = $derived(maxTickSet[maxTickSet.length - 1] ?? 1)

function colorAt(index: number, entry: ChartSeries): string {
  return (
    entry.color ?? CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length] ?? CHART_SERIES_COLORS[0]
  )
}

const xLabels = $derived(thinLabels(categories, 8))

function slotLeft(index: number): number {
  const slotWidth = plotWidth / Math.max(1, categories.length)
  return PLOT.left + index * slotWidth + slotWidth * 0.15
}

function slotWidth(): number {
  return (plotWidth / Math.max(1, categories.length)) * 0.7
}

/** Cumulative bottoms so nulls skip a segment without shifting the stack. */
function stackSegments(
  categoryIndex: number,
): { entry: ChartSeries; seriesIndex: number; bottom: number; height: number }[] {
  let cumulative = 0
  const segments: { entry: ChartSeries; seriesIndex: number; bottom: number; height: number }[] = []
  series.forEach((entry, seriesIndex) => {
    const value = entry.values[categoryIndex] ?? null
    if (value === null || !Number.isFinite(value) || value <= 0) return
    const height = yMax > 0 ? (value / yMax) * plotHeight : 0
    segments.push({ entry, seriesIndex, bottom: cumulative, height })
    cumulative += height
  })
  return segments
}

const flaggedIndexes = $derived.by(() => {
  if (!flags) return [] as number[]
  return flags.map((flag, index) => (flag ? index : -1)).filter((index) => index >= 0)
})
</script>

<div class="sanvi-stacked-bar {className}">
  {#if hasData}
    <svg
      viewBox="0 0 {VB_W} {VB_H}"
      {...(labels.summary
        ? { role: 'img', 'aria-label': labels.summary }
        : { 'aria-hidden': 'true' })}
      class="sanvi-stacked-bar__svg"
    >
      <defs>
        {#each series as entry, seriesIndex (entry.key)}
          <pattern
            id="sanvi-hatch-{uid}-{entry.key}"
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate({hatchRotation(seriesIndex)})"
          >
            <rect width="6" height="6" fill={colorAt(seriesIndex, entry)} />
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="6"
              stroke="var(--sanvi-color-background-primary)"
              stroke-width="1.5"
            />
          </pattern>
        {/each}
      </defs>

      {#each maxTickSet as tick (tick)}
        {@const y = VB_H - PLOT.bottom - (tick / yMax) * plotHeight}
        <line x1={PLOT.left} y1={y} x2={VB_W - PLOT.right} y2={y} class="sanvi-stacked-bar__grid" />
        <text x={PLOT.left - 8} {y} dy="0.32em" text-anchor="end" class="sanvi-stacked-bar__tick">
          {yFormat(tick)}
        </text>
      {/each}

      {#each categories as category, index (category)}
        {@const segments = stackSegments(index)}
        {#each segments as segment (segment.entry.key)}
          <rect
            x={slotLeft(index)}
            y={VB_H - PLOT.bottom - segment.bottom - segment.height}
            width={slotWidth()}
            height={segment.height}
            fill="url(#sanvi-hatch-{uid}-{segment.entry.key})"
          >
            <title>{segment.entry.label}: {yFormat(segment.entry.values[index] ?? 0)}</title>
          </rect>
        {/each}
        {#if xLabels[index]}
          <text
            x={slotLeft(index) + slotWidth() / 2}
            y={VB_H - PLOT.bottom + 20}
            text-anchor="middle"
            class="sanvi-stacked-bar__tick"
          >
            {xLabels[index]}
          </text>
        {/if}
        {#if flags?.[index]}
          <text
            x={slotLeft(index) + slotWidth() / 2}
            y={VB_H - PLOT.bottom + 38}
            text-anchor="middle"
            class="sanvi-stacked-bar__flag"
          >
            ◆<title>{flags[index] ?? ''}</title>
          </text>
        {/if}
      {/each}
    </svg>

    <ul class="sanvi-stacked-bar__legend">
      {#each series as entry, seriesIndex (entry.key)}
        <li class="sanvi-stacked-bar__legend-item">
          <svg viewBox="0 0 12 12" aria-hidden="true" class="sanvi-stacked-bar__legend-swatch">
            <rect width="12" height="12" fill="url(#sanvi-hatch-{uid}-{entry.key})" />
          </svg>
          <span>{entry.label}</span>
        </li>
      {/each}
    </ul>

    {#if flags?.some((flag) => flag)}
      <p class="sanvi-stacked-bar__flag-note">◆ {flags?.find((flag) => flag)}</p>
    {/if}
  {:else if labels.empty}
    <p class="sanvi-stacked-bar__empty">{labels.empty}</p>
  {/if}

  {#if hasData}
    <details class="sanvi-stacked-bar__table">
      <summary>{labels.dataTable}</summary>
      <ChartDataTable {categories} {series} {flags} valueFormat={cellFormat} {labels} />
    </details>
  {/if}
</div>

<style>
  .sanvi-stacked-bar {
    display: flex;
    flex-direction: column;
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-stacked-bar__svg {
    inline-size: 100%;
    block-size: auto;
  }

  .sanvi-stacked-bar__grid {
    stroke: var(--sanvi-color-chart-grid);
    stroke-width: var(--sanvi-border-width-thin);
  }

  .sanvi-stacked-bar__tick {
    fill: var(--sanvi-color-text-secondary);
    font-size: var(--sanvi-font-size-xs);
  }

  .sanvi-stacked-bar__flag {
    fill: var(--sanvi-color-status-warning);
    font-size: var(--sanvi-font-size-xs);
  }

  .sanvi-stacked-bar__legend {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sanvi-spacing-2) var(--sanvi-spacing-4);
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-stacked-bar__legend-item {
    display: flex;
    align-items: center;
    gap: var(--sanvi-spacing-2);
  }

  .sanvi-stacked-bar__legend-swatch {
    inline-size: var(--sanvi-spacing-3);
    block-size: var(--sanvi-spacing-3);
  }

  .sanvi-stacked-bar__flag-note {
    margin: 0;
    font-size: var(--sanvi-font-size-xs);
    color: var(--sanvi-color-text-secondary);
  }

  .sanvi-stacked-bar__empty {
    margin: 0;
    padding: var(--sanvi-spacing-8) var(--sanvi-spacing-4);
    border: var(--sanvi-border-width-thin) dashed var(--sanvi-color-border-default);
    border-radius: var(--sanvi-radius-md);
    color: var(--sanvi-color-text-secondary);
    text-align: center;
  }

  .sanvi-stacked-bar__table summary {
    cursor: pointer;
    font-size: var(--sanvi-font-size-sm);
    color: var(--sanvi-color-text-secondary);
  }
</style>
