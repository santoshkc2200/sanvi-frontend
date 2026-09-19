import { ApiError } from '@sanvi/api-client/problem'
import type { ReleaseStamp } from './types'
import { scrubText, scrubUrl } from './scrub'

/**
 * Diagnostics (FR-1106): the shared breadcrumb buffer behind both consumers,
 * and the one function that renders a support paste. Imported through the
 * package's `./diagnostics` subpath — deliberately *not* the root entry, so
 * an error screen never pulls the vitals graph (`web-vitals`) into its
 * bundle just to format a paste.
 *
 * Two consumers, one buffer:
 * - the error tracker (`initErrorTracker`) snapshots it into every error
 *   report it transmits — subject to the directive gate like anything else;
 * - the error screens call `buildDiagnosticsPaste` for the copy-diagnostics
 *   action — a user-initiated, first-person copy to the clipboard, not a
 *   telemetry destination, which is why it works even while collection is
 *   suppressed.
 *
 * The buffer holds scrubbed route-pattern-shaped crumbs only, never
 * transmits by itself, and is capped — "the last few breadcrumbs" is the
 * requirement, and an uncapped buffer is a memory leak with a UI.
 */

export interface Breadcrumb {
  timestamp: number
  /** Coarse category — `navigation`, `api`, `error`, `ui`. Never free-form user data. */
  category: string
  /** One scrubbed line: a route pattern, a `METHOD path → status`, an error name. */
  message: string
}

const BREADCRUMB_LIMIT = 10

const buffer: Breadcrumb[] = []

/**
 * Records one breadcrumb, scrubbed at record time (defense in depth: the
 * tracker and the paste builder must never have to trust a caller). Route
 * crumbs should be route *patterns* — a raw path with ids embedded would
 * give every detail visit its own bucket and leak ids into the paste.
 */
export function recordDiagnosticBreadcrumb(category: string, message: string): void {
  const crumb: Breadcrumb = {
    timestamp: Date.now(),
    category: scrubText(category, 24),
    message: scrubUrl(scrubText(message, 200)),
  }
  buffer.push(crumb)
  if (buffer.length > BREADCRUMB_LIMIT) buffer.splice(0, buffer.length - BREADCRUMB_LIMIT)
}

/** A copy of the current buffer, oldest first. */
export function recentBreadcrumbs(): Breadcrumb[] {
  return [...buffer]
}

/** Test and consent-revocation seam: the buffer is process-local recall, not state to preserve. */
export function clearDiagnosticBreadcrumbs(): void {
  buffer.length = 0
}

/**
 * The trace id an error carries, resolved through the layers that can know
 * it: an {@link ApiError}'s `problem.trace_id` first (the backend's own
 * convention), `undefined` for anything else — the caller falls back to the
 * api-client's `getLastTraceId()`.
 */
export function errorTraceId(error: unknown): string | undefined {
  return error instanceof ApiError ? error.traceId : undefined
}

export interface DiagnosticsFields {
  release: ReleaseStamp
  /** Route *pattern* (`/products/[id]`), not the raw path with ids. */
  route: string
  tenantId: string | null
  locale: string
  traceId: string | null
  breadcrumbs?: Breadcrumb[]
}

const SECTION_STYLE = {
  absent: 'none',
  breadcrumbsEmpty: '  (none recorded)',
  indent: '  ',
} as const

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString()
}

/**
 * Renders the one paste (FR-1106): release, route, tenant, locale, trace id,
 * breadcrumbs — six fixed sections, plain text, stable ordering, so support
 * tooling (and a tired human at 2 a.m.) can parse it the same way every
 * time. Every section is always present; an unknown value says `none`
 * rather than vanishing, because an absent line reads as a builder bug, not
 * a missing datum.
 */
export function buildDiagnosticsPaste(fields: DiagnosticsFields): string {
  const release = fields.release
  const lines = [
    'Sanvi diagnostics',
    `release: ${release.commit} v${release.version} (built ${release.built_at}, ${release.environment})`,
    `route: ${fields.route || SECTION_STYLE.absent}`,
    `tenant: ${fields.tenantId ?? SECTION_STYLE.absent}`,
    `locale: ${fields.locale || SECTION_STYLE.absent}`,
    `trace_id: ${fields.traceId ?? SECTION_STYLE.absent}`,
    'breadcrumbs:',
    ...(fields.breadcrumbs?.length
      ? fields.breadcrumbs.map(
          (crumb) =>
            `${SECTION_STYLE.indent}${formatTimestamp(crumb.timestamp)} ${crumb.category} ${crumb.message}`,
        )
      : [SECTION_STYLE.breadcrumbsEmpty]),
  ]
  return lines.join('\n')
}
