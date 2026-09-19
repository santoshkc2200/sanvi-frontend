export { initTelemetry, type SanviTelemetry, type TelemetryOptions } from './collector'
export {
  buildDiagnosticsPaste,
  clearDiagnosticBreadcrumbs,
  errorTraceId,
  recentBreadcrumbs,
  recordDiagnosticBreadcrumb,
  type Breadcrumb,
  type DiagnosticsFields,
} from './diagnostics'
export { detectDeviceClass } from './device'
export {
  initErrorTracker,
  type ErrorReport,
  type ErrorTrackerOptions,
  type ErrorTransport,
  type SanviErrorTracker,
} from './errors'
export {
  createSessionLogger,
  type LoggingAuditEntry,
  type SessionLogger,
  type SessionLoggerOptions,
  type SessionStorageLike,
} from './logging'
export { shouldSample } from './sampling'
export { sanitizeSegmentation, scrubText, scrubUrl } from './scrub'
export {
  createBeaconTransport,
  createErrorBeaconTransport,
  createNullTransport,
} from './transport'
export type {
  DeviceClass,
  RawObservation,
  ReleaseStamp,
  TelemetryEvent,
  TelemetrySegmentation,
  TelemetrySources,
  TelemetryTransport,
  VitalName,
  VitalRating,
} from './types'
export { createBrowserSources } from './vitals'
