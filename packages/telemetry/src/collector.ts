import type { ConsentStore, ProcessingPurpose } from '@sanvi/consent'
import { sanitizeSegmentation, scrubUrl } from './scrub'
import { shouldSample } from './sampling'
import { createBeaconTransport, createNullTransport } from './transport'
import type {
  RawObservation,
  ReleaseStamp,
  TelemetryEvent,
  TelemetrySegmentation,
  TelemetrySources,
  TelemetryTransport,
} from './types'
import { createBrowserSources } from './vitals'

/**
 * The RUM collector (FR-1101, rescoped): Core Web Vitals plus navigation
 * and resource timing, sampled, scrubbed, and **gated through the phase-05
 * directive resolver like any other purpose** — including the US
 * notice-and-opt-out mode, not only the EU opt-in one. Telemetry is a
 * purpose, not an exception.
 *
 * The three rules this module exists to enforce:
 *
 * 1. **Suppression is the default, asserted by a test, not by
 *    configuration.** With the resolver denying, nothing is emitted at all —
 *    not a reduced payload, not a sampled one. Sources are never started, so
 *    no observation is even taken.
 * 2. **Revocation drops, never queues.** A buffer that flushes on a later
 *    permission would be retroactive collection — the exact phase-05
 *    failure. Stopping clears the buffer in the same tick as the decision.
 * 3. **Off is off.** With `enabled: false` there are no observers, no
 *    listeners, no transport, no network — the whole configuration surface
 *    exists so that switching on later is configuration, not a project.
 */

export interface TelemetryOptions {
  /**
   * Master switch. Ships `false` in every app: there is no collector
   * endpoint and no traffic (see `docs/release/needs-humans.md`, "Needs
   * real traffic"). The flag is documented at each app's wiring site.
   */
  enabled: boolean
  /** Collector endpoint. Absent → the null transport, even when enabled. */
  endpoint?: string
  /**
   * The directive resolver. `null` (no consent wiring on this surface yet)
   * means *denied* — suppression is the default, never an accident.
   */
  store: ConsentStore | null
  /** Defaults to `analytics`: RUM is measurement, the purpose the registry already reserves for it. */
  purpose?: ProcessingPurpose
  /** The build stamp every event carries — see `@sanvi/telemetry/release`. */
  release: ReleaseStamp
  /** Per-page-load participation rate, 0..1. Default 1 (the gate still applies). */
  sampleRate?: number
  /** Snapshot at collection time, per event. */
  segmentation: () => TelemetrySegmentation
  /** Overrides the default beacon transport (tests, or a future endpoint contract). */
  transport?: TelemetryTransport
  /** Overrides the default Core Web Vitals + timing sources (tests). */
  sources?: TelemetrySources[]
  rng?: () => number
  now?: () => number
  /** Events per batch. Default 20. */
  batchLimit?: number
}

export interface SanviTelemetry {
  /** Whether observations are currently being taken and buffered. */
  isCollecting(): boolean
  /** Observations dropped since init — sources over the resource cap, or emissions while denied. */
  droppedCount(): number
  /** Sends the buffered batch now (no-op when nothing is buffered or the gate has since closed). */
  flush(): void
  dispose(): void
}

const DROPPED: SanviTelemetry = {
  isCollecting: () => false,
  droppedCount: () => 0,
  flush: () => {},
  dispose: () => {},
}

export function initTelemetry(options: TelemetryOptions): SanviTelemetry {
  // Off is off — before sampling, before the gate, before anything.
  if (!options.enabled) return DROPPED

  const purpose = options.purpose ?? 'analytics'
  const now = options.now ?? Date.now
  const rng = options.rng ?? Math.random
  const batchLimit = options.batchLimit ?? 20
  const sampleRate = options.sampleRate ?? 1
  const sampledOut = !shouldSample(sampleRate, rng())
  // No endpoint → the null transport, however enabled the collector is:
  // there is nowhere to send anything, so nothing may ever be sent.
  const send =
    options.transport ??
    (options.endpoint
      ? createBeaconTransport({ endpoint: options.endpoint })
      : createNullTransport())

  let started = false
  let disposed = false
  let dropped = 0
  let buffer: TelemetryEvent[] = []
  let stops: Array<() => void> = []

  const allowed = (): boolean => (options.store ? options.store.isAllowed(purpose) : false)

  function removeFlushListeners(): void {
    if (typeof window === 'undefined') return
    window.removeEventListener('pagehide', flush)
    document?.removeEventListener('visibilitychange', onVisibilityChange)
  }

  function addFlushListeners(): void {
    if (typeof window === 'undefined') return
    window.addEventListener('pagehide', flush)
    document?.addEventListener('visibilitychange', onVisibilityChange)
  }

  function onVisibilityChange(): void {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') flush()
  }

  function stop(): void {
    if (!started) return
    started = false
    for (const stopSource of stops) stopSource()
    stops = []
    removeFlushListeners()
    // Revocation drops the buffer — buffering without permission is just
    // collection on a delay.
    buffer = []
  }

  function start(): void {
    if (started || disposed || sampledOut) return
    started = true
    const sources = options.sources ?? createBrowserSources()
    for (const source of sources) {
      stops.push(
        source.start((observation) => {
          emit(observation)
        }),
      )
    }
    addFlushListeners()
  }

  function emit(observation: RawObservation): void {
    if (!started || disposed) {
      dropped += 1
      return
    }
    if (!allowed()) {
      dropped += 1
      return
    }
    buffer.push(buildEvent(observation))
    if (buffer.length >= batchLimit) flush()
  }

  function buildEvent(observation: RawObservation): TelemetryEvent {
    const base = {
      value: null,
      rating: null,
      durationMs: null,
      transferBytes: null,
      resourceUrl: null,
    } as const
    const measured =
      observation.kind === 'vital'
        ? {
            name: observation.name,
            ...base,
            value: observation.value,
            rating: observation.rating ?? null,
          }
        : observation.kind === 'navigation'
          ? { name: observation.name, ...base, value: observation.value }
          : {
              name: 'resource',
              ...base,
              durationMs: observation.durationMs,
              transferBytes: observation.transferBytes,
              // Resource URLs are the one field a source controls verbatim,
              // so they pass through the scrubber here rather than trusting
              // each source — a query string never survives.
              resourceUrl: scrubUrl(observation.url),
            }
    return {
      kind: observation.kind,
      ...measured,
      purpose,
      timestamp: now(),
      sampleRate,
      release: options.release,
      segmentation: sanitizeSegmentation(options.segmentation()),
    }
  }

  function flush(): void {
    if (disposed || buffer.length === 0) return
    const batch = buffer
    buffer = []
    // Re-checked at send time: a directive that arrived between the last
    // emission and this flush closes the batch, it does not ride through.
    if (!allowed()) {
      dropped += batch.length
      return
    }
    send(batch)
  }

  if (options.store) {
    options.store.subscribe(() => {
      if (disposed) return
      if (allowed()) start()
      else stop()
    })
  }

  const telemetry: SanviTelemetry = {
    isCollecting: () => started && allowed(),
    droppedCount: () => dropped,
    flush,
    dispose: () => {
      if (disposed) return
      disposed = true
      stop()
      buffer = []
    },
  }

  // A page that starts allowed (US default, or a stored grant) collects from init.
  if (allowed()) start()

  return telemetry
}
