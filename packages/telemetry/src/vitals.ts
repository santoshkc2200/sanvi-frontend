import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals'
import type { RawObservation, TelemetrySources } from './types'

/**
 * The browser sources behind the default collector: Core Web Vitals via
 * `web-vitals` (Google's reference implementation — INP especially is too
 * easy to get subtly wrong by hand) plus navigation and resource timing off
 * `PerformanceObserver`, per FR-1101. Node-safe by guard: with no `window`
 * or no `PerformanceObserver` a source starts, observes nothing, and stops.
 */

/** Buffer-bomb guard: one page never emits more than this many resource rows. */
const RESOURCE_CAP = 50

type VitalReporter = (metric: {
  value: number
  rating?: 'good' | 'needs-improvement' | 'poor'
}) => void

function vitalsSource(): TelemetrySources {
  return {
    start(onEvent) {
      if (typeof window === 'undefined') return () => {}
      const report =
        (name: 'LCP' | 'CLS' | 'INP' | 'TTFB' | 'FCP'): VitalReporter =>
        (metric) => {
          onEvent({
            kind: 'vital',
            name,
            value: metric.value,
            rating: metric.rating ?? null,
          } satisfies RawObservation)
        }
      const stops: Array<() => void> = []
      for (const [bind, name] of [
        [onLCP, 'LCP'],
        [onCLS, 'CLS'],
        [onINP, 'INP'],
        [onTTFB, 'TTFB'],
        [onFCP, 'FCP'],
      ] as const) {
        // Older web-vitals majors returned void instead of an unbind — treat
        // the return value as an unbind only when it is one.
        const unbind: unknown = bind(report(name))
        if (typeof unbind === 'function') stops.push(unbind as () => void)
      }
      return () => {
        for (const stop of stops) stop()
      }
    },
  }
}

/** Exposed for tests; the default set {@link createBrowserSources} ships is this plus {@link vitalsSource}. */
export function timingSource(): TelemetrySources {
  return {
    start(onEvent) {
      if (typeof PerformanceObserver === 'undefined') return () => {}
      let resources = 0
      const emitNavigation = (timing: PerformanceNavigationTiming): void => {
        onEvent({
          kind: 'navigation',
          name: 'dom-content-loaded',
          value: timing.domContentLoadedEventEnd,
        })
        onEvent({ kind: 'navigation', name: 'load', value: timing.loadEventEnd })
      }
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'navigation') {
            const timing = entry as PerformanceNavigationTiming
            // `buffered` replays the navigation entry the moment collection
            // starts, so for a start that lands mid-load — the common case
            // once a default-allowed visitor's resolver enables us during
            // page load — both timings are still 0, and this observer never
            // re-fires to correct them. The load listener below owns those
            // loads; emit only finished ones here.
            if (timing.loadEventEnd === 0) continue
            emitNavigation(timing)
          } else if (entry.entryType === 'resource') {
            if (resources >= RESOURCE_CAP) continue
            resources += 1
            const resource = entry as PerformanceResourceTiming
            onEvent({
              kind: 'resource',
              url: resource.name,
              durationMs: resource.duration,
              transferBytes: resource.transferSize >= 0 ? resource.transferSize : null,
            })
          }
        }
      })
      // `buffered` replays the entries that fired before collection started —
      // the navigation row of the very page load that enabled us. Types an
      // unsupported engine doesn't know throw at observe(), so each stands alone.
      let stopLoadListener: (() => void) | null = null
      try {
        observer.observe({ type: 'navigation', buffered: true })
        // A start that lands mid-load gets its navigation row here instead:
        // once the load event has fired, read the entry back off the buffer.
        // `loadEventEnd` is stamped only after the event's own handlers
        // return, so the read defers a task rather than running in the
        // handler, where it would still see 0.
        const readNavigationOnLoad = (): void => {
          setTimeout(() => {
            if (typeof performance === 'undefined') return
            const timing = performance.getEntriesByType('navigation')[0] as
              | PerformanceNavigationTiming
              | undefined
            if (timing && timing.loadEventEnd > 0) emitNavigation(timing)
          }, 0)
        }
        if (typeof window !== 'undefined') {
          window.addEventListener('load', readNavigationOnLoad)
          stopLoadListener = () => window.removeEventListener('load', readNavigationOnLoad)
        }
      } catch {
        // Engine without navigation entries — vitals still carry the load.
      }
      try {
        observer.observe({ type: 'resource', buffered: true })
      } catch {
        // Engine without resource entries.
      }
      return () => {
        observer.disconnect()
        stopLoadListener?.()
      }
    },
  }
}

/** The default source set — Core Web Vitals plus navigation and resource timing. */
export function createBrowserSources(): TelemetrySources[] {
  return [vitalsSource(), timingSource()]
}
