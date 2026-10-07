/**
 * Intent-based route prefetch primitives (TASK-022, step 2).
 *
 * The invariant these exist to enforce: **a prefetch that fires on a
 * throttled connection is a regression dressed as an optimisation.** Every
 * prefetch path — the Svelte action below, the `AppShell` nav wiring, any
 * future viewport variant — goes through {@linkcode shouldPrefetch} at fire
 * time (not setup time: connection quality changes mid-session), so
 * `Save-Data` and 2G-class connections never pay for navigation guesses.
 */
export interface NetworkInformationLike {
  saveData?: boolean
  effectiveType?: string
}

/** Connection classes a prefetch would compete with real work on. */
const SLOW_EFFECTIVE_TYPES = new Set(['slow-2g', '2g'])

/**
 * `false` when the user asked the web to use less data (`Save-Data: on`) or
 * the connection class is 2G-or-worse. `connection` is injectable for tests;
 * without an argument it reads `navigator.connection` — Safari and Firefox
 * don't implement the Network Information API at all, and there the answer
 * is `true` (no signal, no guess — the status quo ante).
 */
export function shouldPrefetch(connection?: NetworkInformationLike): boolean {
  const conn = connection ?? (typeof navigator !== 'undefined' ? navigatorConnection() : undefined)
  if (!conn) return true
  if (conn.saveData === true) return false
  if (conn.effectiveType !== undefined && SLOW_EFFECTIVE_TYPES.has(conn.effectiveType)) return false
  return true
}

function navigatorConnection(): NetworkInformationLike | undefined {
  return (navigator as Navigator & { connection?: NetworkInformationLike }).connection
}

/** Events that express intent to navigate this element soon. */
const INTENT_EVENTS = ['pointerenter', 'focusin'] as const

/**
 * Svelte action: warm a route's code on hover or keyboard focus. The loader
 * is the same lazy `import()` the router will call on navigation — dynamic
 * imports are cached, so "fires more than once" is a no-op by construction
 * and the guard re-checks the connection at every event. Listeners detach
 * after the first successful fire: intent has been served.
 *
 * ```svelte
 * <a href="/billing" use:prefetchOnIntent={() => router.prefetch('/billing')}>Billing</a>
 * ```
 */
export function prefetchOnIntent(
  node: HTMLElement,
  loader: () => void,
): {
  update: (next: () => void) => void
  destroy: () => void
} {
  let current = loader
  let detach: (() => void) | null = null

  const fire = () => {
    if (!shouldPrefetch()) return
    current()
    detach?.()
    detach = null
  }

  const attach = () => {
    if (detach) return
    for (const event of INTENT_EVENTS) {
      node.addEventListener(event, fire, { passive: true })
    }
    detach = () => {
      for (const event of INTENT_EVENTS) {
        node.removeEventListener(event, fire)
      }
    }
  }

  attach()

  return {
    update(next: () => void) {
      current = next
    },
    destroy() {
      detach?.()
    },
  }
}
