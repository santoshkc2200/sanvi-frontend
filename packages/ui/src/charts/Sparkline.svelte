<script lang="ts">
import { CHART_SERIES_COLORS } from './math'

/**
 * Sparkline (phase 10, TASK-016) — a single-series miniature for KPI
 * tiles. Its text equivalent is the tile's own value and label (the number
 * beside it is the accessibility story; a data table for a 90-pixel trend
 * line would be noise), so the shape is exposed as a labelled image, never
 * an unlabelled decoration.
 */
interface Props {
  values: (number | null)[]
  /** Accessible name describing what the trend shows, e.g. "Spend, last 30 days". */
  label: string
  /** A full CSS color — pass a token reference. Defaults to the first series token. */
  color?: string
  class?: string
}

let { values, label, color = CHART_SERIES_COLORS[0], class: className = '' }: Props = $props()

const VB_W = 120
const VB_H = 32
const PAD = 2

const finite = $derived(
  values.filter((value) => value !== null && Number.isFinite(value)) as number[],
)
const max = $derived(finite.length > 0 ? Math.max(...finite) : 0)

function xAt(index: number): number {
  if (values.length <= 1) return (VB_W - PAD) / 2 + PAD / 2
  return PAD + (index / (values.length - 1)) * (VB_W - PAD * 2)
}

function yOf(value: number): number {
  if (max <= 0) return VB_H - PAD
  return VB_H - PAD - (value / max) * (VB_H - PAD * 2)
}

/** One polyline per null-free run — gaps, never zero dips. */
const segments = $derived.by(() => {
  const runs: string[] = []
  let current = ''
  values.forEach((value, index) => {
    if (value === null || !Number.isFinite(value)) {
      if (current) runs.push(current)
      current = ''
      return
    }
    current += `${current ? 'L' : 'M'}${xAt(index).toFixed(1)},${yOf(value).toFixed(1)}`
  })
  if (current) runs.push(current)
  return runs
})

const lastFinite = $derived(values.at(-1))
</script>

<svg
  viewBox="0 0 {VB_W} {VB_H}"
  role="img"
  aria-label={label}
  class="sanvi-sparkline {className}"
>
  {#each segments as segment, index (index)}
    <path d={segment} fill="none" stroke={color} stroke-width="2" stroke-linecap="round" />
  {/each}
  {#if lastFinite !== null && lastFinite !== undefined && Number.isFinite(lastFinite)}
    <circle
      cx={xAt(values.length - 1)}
      cy={yOf(lastFinite)}
      r="2.5"
      fill={color}
    />
  {/if}
</svg>
