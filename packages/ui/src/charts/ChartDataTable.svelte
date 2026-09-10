<script lang="ts">
import type { ChartSeries, ChartTableLabels } from './types'

/**
 * The chart data table (phase 10, TASK-016) — the accessible equivalent
 * every chart ships with. Rendered from the *same* `categories`/`series`
 * props the pixels are drawn from, so chart and table cannot disagree.
 * Values arrive pre-formatted from the caller (`valueFormat`), so currency
 * and locale rules live in exactly one place.
 */
interface Props {
  categories: string[]
  series: ChartSeries[]
  /** Pre-formatted cell text for a value; `null` renders an em dash. */
  valueFormat: (value: number) => string
  labels: ChartTableLabels
  /** Per-category extra text (e.g. "still updating"); renders the flag column when present. */
  flags?: (string | null)[]
  class?: string
}

let { categories, series, valueFormat, labels, flags, class: className = '' }: Props = $props()

const captionId = $props.id()
</script>

<div class="sanvi-chart-table {className}">
  <table aria-labelledby={captionId}>
    <caption id={captionId}>{labels.caption}</caption>
    <thead>
      <tr>
        <th scope="col">{labels.categoryHeader}</th>
        {#each series as entry (entry.key)}
          <th scope="col" class="sanvi-chart-table__value">{entry.label}</th>
        {/each}
        {#if labels.flagHeader && flags}
          <th scope="col">{labels.flagHeader}</th>
        {/if}
      </tr>
    </thead>
    <tbody>
      {#each categories as category, index (category)}
        <tr>
          <th scope="row">{category}</th>
          {#each series as entry (entry.key)}
            {@const value = entry.values[index]}
            <td class="sanvi-chart-table__value">
              {value === null || value === undefined || !Number.isFinite(value) ? '—' : valueFormat(value)}
            </td>
          {/each}
          {#if labels.flagHeader && flags}
            <td>{flags[index] ?? ''}</td>
          {/if}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .sanvi-chart-table {
    max-block-size: var(--sanvi-spacing-48);
    overflow: auto;
  }

  .sanvi-chart-table table {
    inline-size: 100%;
    border-collapse: collapse;
    font-size: var(--sanvi-font-size-sm);
  }

  .sanvi-chart-table caption {
    text-align: start;
    color: var(--sanvi-color-text-secondary);
    padding-block-end: var(--sanvi-spacing-2);
  }

  .sanvi-chart-table th,
  .sanvi-chart-table td {
    text-align: start;
    padding: var(--sanvi-spacing-1) var(--sanvi-spacing-2);
    border-block-end: var(--sanvi-border-width-thin) solid var(--sanvi-color-border-default);
  }

  .sanvi-chart-table__value {
    text-align: end;
    font-variant-numeric: tabular-nums;
  }
</style>
