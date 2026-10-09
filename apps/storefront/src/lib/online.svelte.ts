// The `./offline` subpath, not the package root — the root entry pulls
// every endpoint module, and this store sits in the storefront's initial
// bundle (the TASK-020 lesson: a root import cost the storefront 32 KB).
import { isOnline, watchOnline } from '@sanvi/api-client/offline'

/**
 * Reactive connectivity for the storefront (TASK-023 step 7): `offline` is
 * true while the browser reports the tab offline. Client-only — the server
 * is never offline in any sense this module can know, so SSR renders as
 * online and hydration adopts the browser's value through the same event
 * subscription every other surface uses.
 *
 * Deliberately event-driven, not probing: `navigator.onLine` says the OS
 * changed the network, nothing more, and the banner copy is written to
 * promise exactly that much and no more.
 */
const state = $state({ offline: false })

if (typeof window !== 'undefined') {
  state.offline = !isOnline()
  watchOnline({
    onOnline: () => {
      state.offline = false
    },
    onOffline: () => {
      state.offline = true
    },
  })
}

export function isOffline(): boolean {
  return state.offline
}
