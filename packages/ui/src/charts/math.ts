/**
 * Scale math for the chart primitives — dependency-free, unit-tested,
 * locale-free. Nice ticks and point-mapping are where chart bugs hide
 * (division by zero on empty ranges, a single point at +/-infinity), so the
 * edge cases are explicit here rather than emergent in the SVG.
 */

/**
 * Y-axis ticks from zero up past `maxValue`, rounded to "nice" steps
 * (1/2/2.5/5 × 10ⁿ). Always returns at least `[0, 1]` so an empty or
 * all-zero chart renders a sane axis instead of dividing by zero.
 */
export function niceTicks(maxValue: number, targetCount = 4): number[] {
  if (!Number.isFinite(maxValue) || maxValue <= 0) return [0, 1]
  const roughStep = maxValue / Math.max(1, targetCount)
  const magnitude = 10 ** Math.floor(Math.log10(roughStep))
  const residual = roughStep / magnitude
  const factor = residual >= 5 ? 5 : residual >= 2.5 ? 2.5 : residual >= 2 ? 2 : 1
  const step = factor * magnitude
  const top = Math.ceil(maxValue / step) * step
  const ticks: number[] = []
  for (let value = 0; value <= top + step / 2; value += step) ticks.push(value)
  return ticks
}

/** Fraction of the y range a value sits at, guarded to [0, 1]. */
export function yFraction(value: number, max: number): number {
  if (!Number.isFinite(value) || max <= 0) return 0
  return Math.min(1, Math.max(0, value / max))
}

/**
 * X position (in viewBox units) of category `index` of `count`, inset by
 * the plot padding. `count <= 1` returns the horizontal centre of the plot
 * — a single-point series renders centred, not at a degenerate 0/0.
 */
export function xAt(index: number, count: number, left: number, right: number): number {
  if (count <= 0) return left
  if (count === 1) return (left + right) / 2
  return left + (index / (count - 1)) * (right - left)
}

/** The series default palette — the categorical chart tokens by index. */
export const CHART_SERIES_COLORS = [
  'var(--sanvi-color-chart-series-1)',
  'var(--sanvi-color-chart-series-2)',
  'var(--sanvi-color-chart-series-3)',
  'var(--sanvi-color-chart-series-4)',
] as const

/**
 * The non-colour encoding that pairs with each palette slot: dash patterns
 * for strokes, hatch rotations for fills. Two series never differ by hue
 * alone (WCAG 1.4.1).
 */
export const CHART_DASH_PATTERNS = ['', '7 4', '2 4', '7 4 2 4'] as const

/** Hatch rotation (degrees) for stacked-bar fills, by series index. */
export function hatchRotation(index: number): number {
  return (index + 1) * 45
}

/** Evenly thins labels to at most `maxCount`, always keeping the first and last. */
export function thinLabels(labels: string[], maxCount: number): (string | null)[] {
  if (labels.length <= maxCount) return labels.map((label) => label)
  const keep = new Set<number>()
  for (let i = 0; i < maxCount; i += 1) {
    keep.add(Math.round((i / (maxCount - 1)) * (labels.length - 1)))
  }
  keep.add(labels.length - 1)
  return labels.map((label, i) => (keep.has(i) ? label : null))
}
