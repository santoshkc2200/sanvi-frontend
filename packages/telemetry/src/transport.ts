import { createKeepalivePoster } from '@sanvi/api-client'
import type { TelemetryEvent, TelemetryTransport } from './types'

/**
 * The transport is the only thing that touches the network, and there is no
 * endpoint to touch: the backend ships no collector yet (see
 * `docs/release/needs-humans.md`, "Needs real traffic"). Until one exists,
 * every app wires the collector with no `endpoint` and gets the null
 * transport — wired, off, and honest about which one it is.
 *
 * The fetch itself lives in `@sanvi/api-client` (`createKeepalivePoster`) —
 * the one place the workspace allows a `fetch`, same decision as TASK-014's
 * conversion beacon.
 */

/** Accepts and drops everything. Never constructs a request. */
export function createNullTransport(): TelemetryTransport {
  return () => {}
}

/**
 * Batched keepalive POST. `sendBeacon` cannot be the primary because a
 * batch larger than the beacon quota is silently dropped, and batching is
 * the point. Failures are swallowed — telemetry must never surface its own
 * breakage into the page.
 */
export function createBeaconTransport(options: {
  endpoint: string
  fetchImpl?: typeof fetch
}): TelemetryTransport {
  const post = createKeepalivePoster({ endpoint: options.endpoint, fetchImpl: options.fetchImpl })
  return (events: TelemetryEvent[]) => {
    if (events.length === 0) return
    post({ events })
  }
}
