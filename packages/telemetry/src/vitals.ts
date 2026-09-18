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

function timingSource(): TelemetrySources {
  return {
    start(onEvent) {
      if (typeof PerformanceObserver === 'undefined') return () => {}
      let resources = 0
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'navigation') {
            const timing = entry as PerformanceNavigationTiming
            onEvent({
              kind: 'navigation',
              name: 'dom-content-loaded',
              value: timing.domContentLoadedEventEnd,
            })
            onEvent({ kind: 'navigation', name: 'load', value: timing.loadEventEnd })
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
      try {
        observer.observe({ type: 'navigation', buffered: true })
      } catch {
        // Engine without navigation entries — vitals still carry the load.
      }
      try {
        observer.observe({ type: 'resource', buffered: true })
      } catch {
        // Engine without resource entries.
      }
      return () => observer.disconnect()
    },
  }
}

/** The default source set — Core Web Vitals plus navigation and resource timing. */
export function createBrowserSources(): TelemetrySources[] {
  return [vitalsSource(), timingSource()]
}
