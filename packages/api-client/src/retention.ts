import type { ApiClient } from './client'

/**
 * The retention report (TASK-028, FR-1130): proof from live data that the
 * phase-05 rules actually execute — per class, the rule, its last recorded
 * run, the rows that run affected, and the oldest surviving row. Shapes
 * mirrored from the backend's serde structs
 * (sanvi-backend `apps/cli/src/retention_report.rs`), which are the single
 * source the evidence packs (TASK-029) consume too.
 *
 * CROSS-REPO GAP (recorded in docs/release/needs-humans.md): the backend
 * serves this report from the CLI and evaluates its staleness alert from the
 * same ledger, but does not yet expose it over HTTP. This module pins the
 * client-side contract at
 * `GET /api/v1/platform/privacy/retention/report` through the raw
 * {@link ApiClient} escape — the generated `TypedApiClient` is keyed to the
 * OpenAPI path set and cannot carry an un-spec'd path. When the backend
 * lands the operation, this wrapper moves to the generated path type with no
 * call-site change.
 */

export const RETENTION_REPORT_PATH = '/api/v1/platform/privacy/retention/report'

/** The last recorded run of one class's executor — a fact from `privacy.retention_runs`, never a promise. */
export interface RetentionLastRun {
  runAt: string
  action: string
  rowsAffected: number
  executor: string
}

/** One retention class's report row. */
export interface RetentionClassReport {
  dataClass: string
  sensitivity: string
  /** Legal basis, when the rule declares one. */
  basis: string | undefined
  periodDays: number
  action: string
  /** `executor:<name>` | `by-construction (…)` | `tenant-lifecycle` | `unenforced`. */
  enforcement: string
  /** The scheduled executor, for the classes one exists for. */
  executor: string | undefined
  lastRun: RetentionLastRun | undefined
  /** RFC 3339 of the oldest row still living in the class's table. */
  oldestSurvivingRow: string | undefined
  /** `true` when an executor-backed class has not run inside its window; `undefined` when the question does not apply. */
  stalled: boolean | undefined
}

export interface RetentionReport {
  generatedAt: string
  /** The staleness window applied to executor-backed classes. */
  stalenessWindowHours: number
  classes: RetentionClassReport[]
  /** The data classes currently flagged stalled — the alert's input. */
  stalledClasses: string[]
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function parseLastRun(value: unknown): RetentionLastRun | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const wire = value as {
    run_at?: unknown
    action?: unknown
    rows_affected?: unknown
    executor?: unknown
  }
  if (
    !nonEmptyString(wire.run_at) ||
    !nonEmptyString(wire.action) ||
    typeof wire.rows_affected !== 'number' ||
    !Number.isInteger(wire.rows_affected) ||
    wire.rows_affected < 0 ||
    !nonEmptyString(wire.executor)
  ) {
    return undefined
  }
  return {
    runAt: wire.run_at,
    action: wire.action,
    rowsAffected: wire.rows_affected,
    executor: wire.executor,
  }
}

function parseClass(value: unknown): RetentionClassReport | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const wire = value as {
    data_class?: unknown
    sensitivity?: unknown
    basis?: unknown
    period_days?: unknown
    action?: unknown
    enforcement?: unknown
    executor?: unknown
    last_run?: unknown
    oldest_surviving_row?: unknown
    stalled?: unknown
  }
  if (
    !nonEmptyString(wire.data_class) ||
    !nonEmptyString(wire.sensitivity) ||
    typeof wire.period_days !== 'number' ||
    !Number.isInteger(wire.period_days) ||
    wire.period_days < 0 ||
    !nonEmptyString(wire.action) ||
    !nonEmptyString(wire.enforcement)
  ) {
    return undefined
  }
  const lastRun = wire.last_run === undefined ? undefined : parseLastRun(wire.last_run)
  if (wire.last_run !== undefined && lastRun === undefined) return undefined
  const executor = nonEmptyString(wire.executor) ? wire.executor : undefined
  // An executor-backed class with no recorded run is stalled by definition:
  // the window has passed (infinitely many), so the report must flag it. The
  // enforcement string is the invariant (`executor:<name>`); the explicit
  // executor member may be absent on older report shapes.
  const executorBacked = executor !== undefined || wire.enforcement.startsWith('executor:')
  const stalled =
    typeof wire.stalled === 'boolean'
      ? wire.stalled
      : wire.stalled === null || wire.stalled === undefined
        ? executorBacked && lastRun === undefined
          ? true
          : undefined
        : undefined
  return {
    dataClass: wire.data_class,
    sensitivity: wire.sensitivity,
    basis: nonEmptyString(wire.basis) ? wire.basis : undefined,
    periodDays: wire.period_days,
    action: wire.action,
    enforcement: wire.enforcement,
    executor,
    lastRun,
    oldestSurvivingRow: nonEmptyString(wire.oldest_surviving_row)
      ? wire.oldest_surviving_row
      : undefined,
    stalled,
  }
}

/**
 * Validates the wire JSON into the typed report; rows that do not validate
 * are dropped, never rendered. Returns `undefined` for anything that is not
 * recognisably a report — the surface then says the report is unavailable
 * rather than rendering an empty table.
 */
export function parseRetentionReport(raw: unknown): RetentionReport | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const wire = raw as {
    generated_at?: unknown
    staleness_window_hours?: unknown
    classes?: unknown
    stalled_classes?: unknown
  }
  if (!nonEmptyString(wire.generated_at) || !Array.isArray(wire.classes)) return undefined
  const stalenessWindowHours =
    typeof wire.staleness_window_hours === 'number' && wire.staleness_window_hours >= 0
      ? wire.staleness_window_hours
      : 48

  const classes: RetentionClassReport[] = []
  for (const entry of wire.classes) {
    const parsed = parseClass(entry)
    if (parsed) classes.push(parsed)
  }

  const stalledClasses = Array.isArray(wire.stalled_classes)
    ? wire.stalled_classes.filter(nonEmptyString)
    : []

  return {
    generatedAt: wire.generated_at,
    stalenessWindowHours,
    classes,
    stalledClasses,
  }
}

/**
 * `GET /api/v1/platform/privacy/retention/report` — the per-class report.
 * Takes the raw {@link ApiClient} while the operation is outside the
 * generated spec (see the module comment).
 */
export function getRetentionReport(
  client: ApiClient,
  signal?: AbortSignal,
): Promise<RetentionReport | undefined> {
  return client
    .request<unknown>(RETENTION_REPORT_PATH, { method: 'GET', ...(signal ? { signal } : {}) })
    .then(parseRetentionReport)
}
