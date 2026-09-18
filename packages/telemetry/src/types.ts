import type { components } from '@sanvi/api-client'
import type { ProcessingPurpose } from '@sanvi/consent'

/**
 * The release stamp (`GET /api/v1/system/build`, FR-1102). Re-exported from
 * the generated contract types, never redefined here: the backend owns the
 * shape, and an app's embedded stamp must be field-for-field the response
 * the build endpoint returns.
 */
export type ReleaseStamp = components['schemas']['BuildDetails']

export type DeviceClass = 'mobile' | 'tablet' | 'desktop'

export type VitalName = 'LCP' | 'CLS' | 'INP' | 'TTFB' | 'FCP'
export type VitalRating = 'good' | 'needs-improvement' | 'poor'

/**
 * Who, where, and on what a measurement was taken — snapshotted at
 * collection time so querying by these dimensions later (TASK-020's parked
 * segmentation work) never needs a client change.
 */
export interface TelemetrySegmentation {
  /** Route pattern or path the app identifies itself by — scrubbed of any query string. */
  route: string
  /** Active tenant id, or null when the surface has none. Sanitized to opaque-id shape. */
  tenantId: string | null
  locale: string
  deviceClass: DeviceClass
  /** Revision of the published theme rendering the page, when the app tracks one. */
  themeRevision: number | null
}

/** One raw observation from a source, before scrubbing and enrichment. */
export type RawObservation =
  | { kind: 'vital'; name: VitalName; value: number; rating?: VitalRating | null }
  | { kind: 'navigation'; name: string; value: number }
  | { kind: 'resource'; url: string; durationMs: number; transferBytes: number | null }

/** One scrubbed, enriched event — the only shape that ever reaches a transport. */
export interface TelemetryEvent {
  kind: 'vital' | 'navigation' | 'resource'
  name: string
  value: number | null
  rating: VitalRating | null
  durationMs: number | null
  transferBytes: number | null
  /** Scrubbed resource URL — origin + pathname; query string and fragment never survive. Null for page-level events. */
  resourceUrl: string | null
  purpose: ProcessingPurpose
  timestamp: number
  sampleRate: number
  release: ReleaseStamp
  segmentation: TelemetrySegmentation
}

/**
 * A collector input. `start` is called only when the directive resolver
 * allows, sampling includes the page, and the collector is enabled — a
 * source that was never started took no observation at all. Returns the
 * stop function; after it runs the source must emit nothing further.
 */
export interface TelemetrySources {
  start(onEvent: (observation: RawObservation) => void): () => void
}

/** Where flushed event batches go. Must never throw into the page. */
export type TelemetryTransport = (events: TelemetryEvent[]) => void
