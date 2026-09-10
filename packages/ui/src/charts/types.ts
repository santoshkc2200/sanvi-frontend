/**
 * Shared shapes for the chart primitives (phase 10, TASK-016).
 *
 * The model is tabular on purpose: charts take already-formatted category
 * labels and one value array per series, which is exactly the shape an
 * accessible data table needs — the table equivalent is derived from the
 * same props the pixels are, so the two can never disagree. Formatting
 * (money, ratios, numbers) happens in the caller where the locale lives;
 * these components are presentational and locale-free by the
 * labels-as-data rule.
 */

/** One named value array across the chart's categories. */
export interface ChartSeries {
  /** Stable key for rendering and tests. */
  key: string
  /** Localized series name, as it should read in the legend and the table header. */
  label: string
  /**
   * A full CSS color — pass a token reference such as
   * `var(--sanvi-color-chart-revenue)`. Defaults to the indexed categorical
   * series token. Charts never accept or emit raw hex.
   */
  color?: string
  /** One value per category; `null` is an unmeasured gap, never zero. */
  values: (number | null)[]
}

/**
 * The labels every chart needs to ship its accessible data table — not an
 * afterthought, a required prop: a chart whose caller cannot name the table
 * has no business rendering pixels alone.
 */
export interface ChartTableLabels {
  /** Visible disclosure label for the table, e.g. "View as data table". */
  dataTable: string
  /** Accessible caption binding the table to its chart. */
  caption: string
  /** Column header of the category axis, e.g. "Date". */
  categoryHeader: string
  /** Optional extra per-row column (e.g. restatement status) header. */
  flagHeader?: string
}

/** Shared optional labels for the chart frame. */
export interface ChartFrameLabels {
  /** Empty-state text when there is nothing to plot (no categories or all-null series). */
  empty?: string
  /**
   * Accessible summary of the SVG itself (`role="img"` label) — a sentence,
   * while the table carries the exact values.
   */
  summary?: string
}
