import { ApiError } from '@sanvi/api-client/problem'
import type { ConsentStore, ProcessingPurpose } from '@sanvi/consent'
import { recordDiagnosticBreadcrumb, recentBreadcrumbs, type Breadcrumb } from './diagnostics'
import { sanitizeSegmentation, scrubText } from './scrub'
import type { ReleaseStamp, TelemetrySegmentation } from './types'

/**
 * The error tracker (FR-1104): captures a frontend failure as a scrubbed,
 * release-tagged, directive-gated report — the sibling of the RUM collector
 * in `./collector`, and bound by the same three rules:
 *
 * 1. **Suppression is the default, asserted by a test.** A denied resolver
 *    means nothing is built and nothing is sent — not a reduced report.
 * 2. **Revocation drops, never queues.** Reports send immediately or not at
 *    all; there is no buffer that a later permission could flush.
 * 3. **Off is off.** `enabled: false` returns a tracker that cannot capture,
 *    and no app ships with it enabled while there is no collector endpoint.
 *
 * One deliberate asymmetry, documented rather than hidden: the shared
 * breadcrumb buffer (user-initiated recall for the copy-diagnostics paste)
 * keeps recording while the tracker is suppressed — the buffer never
 * transmits by itself, and the paste is the user quoting their own session
 * to support, not a telemetry destination. The *report* path below is the
 * gated one.
 */

const STACK_MAX_LENGTH = 2048

/** One scrubbed failure — the only error shape that ever reaches a transport. */
export interface ErrorReport {
  name: string
  message: string
  stack: string | null
  /** `ApiError`'s status; null for non-API failures. */
  status: number | null
  traceId: string | null
  timestamp: number
  release: ReleaseStamp
  segmentation: TelemetrySegmentation
  breadcrumbs: Breadcrumb[]
}

/** Where an error report goes. Must never throw into the page. */
export type ErrorTransport = (report: ErrorReport) => void

export interface ErrorTrackerOptions {
  /** Master switch. Ships `false` in every app — see `docs/release/needs-humans.md`. */
  enabled: boolean
  /** Collector endpoint. Absent → the null transport, even when enabled. */
  endpoint?: string
  /** The directive resolver. `null` means *denied* — suppression is the default. */
  store: ConsentStore | null
  /** Defaults to `analytics`, the same purpose the RUM collector gates on. */
  purpose?: ProcessingPurpose
  /** The build stamp every report carries — see `@sanvi/telemetry/release`. */
  release: ReleaseStamp
  /** Snapshot at capture time, per report. */
  segmentation: () => TelemetrySegmentation
  /**
   * Fallback trace id (the api-client's `getLastTraceId` is the natural
   * wiring) for failures that carry no `problem.trace_id` of their own.
   */
  getTraceId?: () => string | undefined
  /** Overrides the default error beacon transport (tests, or a future endpoint contract). */
  transport?: ErrorTransport
  now?: () => number
}

export interface SanviErrorTracker {
  /**
   * Captures one failure. Non-throwing and non-async by contract — an error
   * handler must never be able to make things worse. When the directive gate
   * is closed the report is dropped (counted), and only a breadcrumb stays
   * behind for the paste.
   */
  captureError(error: unknown, context?: { traceId?: string | null }): void
  /** Reports dropped since init — captured while suppressed or disposed. */
  droppedCount(): number
  isCapturing(): boolean
  dispose(): void
}

const DISABLED: SanviErrorTracker = {
  captureError: () => {},
  droppedCount: () => 0,
  isCapturing: () => false,
  dispose: () => {},
}

function describeError(error: unknown): { name: string; message: string; stack: string | null } {
  if (error instanceof Error) {
    return {
      name: error.name || 'Error',
      message: scrubText(error.message),
      stack: error.stack ? scrubText(error.stack, STACK_MAX_LENGTH) : null,
    }
  }
  // A thrown non-Error (a string, a problem object) still deserves a report
  // — String() of it, scrubbed like any other free text.
  return { name: 'NonError', message: scrubText(String(error)), stack: null }
}

export function initErrorTracker(options: ErrorTrackerOptions): SanviErrorTracker {
  if (!options.enabled) return DISABLED

  const purpose = options.purpose ?? 'analytics'
  const now = options.now ?? Date.now
  const send = options.transport ?? (() => {})
  let disposed = false
  let dropped = 0

  const allowed = (): boolean => (options.store ? options.store.isAllowed(purpose) : false)

  function buildReport(error: unknown, traceId: string | null): ErrorReport {
    const described = describeError(error)
    const status = error instanceof ApiError ? error.status : null
    return {
      ...described,
      status,
      traceId,
      timestamp: now(),
      release: options.release,
      segmentation: sanitizeSegmentation(options.segmentation()),
      breadcrumbs: recentBreadcrumbs(),
    }
  }

  const tracker: SanviErrorTracker = {
    captureError(error, context) {
      // The breadcrumb is recorded before the gate check: it is local recall
      // for the copy-diagnostics paste (see the module doc for why this
      // asymmetry is deliberate), and "an error happened" is exactly the
      // crumb a later paste needs even while transmission is suppressed.
      const described = describeError(error)
      recordDiagnosticBreadcrumb('error', `${described.name}: ${described.message}`)
      if (disposed || !allowed()) {
        dropped += 1
        return
      }
      const traceId =
        context?.traceId ??
        (error instanceof ApiError ? error.traceId : undefined) ??
        options.getTraceId?.() ??
        null
      send(buildReport(error, traceId))
    },
    droppedCount: () => dropped,
    isCapturing: () => !disposed && allowed(),
    dispose: () => {
      disposed = true
    },
  }

  return tracker
}
