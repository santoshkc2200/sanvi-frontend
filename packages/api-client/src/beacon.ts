/**
 * Fire-and-forget keepalive POSTs — the one fetch shape that is not an API
 * call (no auth, no tenant header, no problem+json), so it lives here with
 * every other `fetch` (TASK-014's conversion beacon sender set the
 * precedent; TASK-019's RUM transport uses the same factory). Callers get a
 * function that never throws and never awaits: telemetry must not be able
 * to break the page that measures it.
 */

export interface KeepalivePosterOptions {
  endpoint: string
  /** Injected for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch
}

export type KeepalivePoster = (payload: unknown) => void

export function createKeepalivePoster(options: KeepalivePosterOptions): KeepalivePoster {
  const doFetch = options.fetchImpl ?? fetch.bind(globalThis)
  return (payload: unknown) => {
    try {
      void doFetch(options.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
        // Fire-and-forget measurement carries no credentials and wants none.
        credentials: 'omit',
      }).catch(() => {})
    } catch {
      // Constructing the request must not throw either.
    }
  }
}
