import { getContext, hasContext, setContext } from 'svelte'
import type { Session } from './session'

const KEY = Symbol('sanvi.auth.session')

/**
 * SSR-safe: Svelte's context API is per-component-tree, so this never leaks
 * across concurrent server requests the way a module-level store would (see
 * `@sanvi/tenant`'s `context.ts` for the same reasoning). Call once from the
 * storefront's root `+layout.svelte`, sourced from `+layout.server.ts`'s
 * `load` (which itself calls `@sanvi/auth/server`'s `resolveSession`).
 */
export function setSessionContext(session: Session | null): void {
  setContext(KEY, session)
}

export function getSessionContext(): Session | null {
  return hasContext(KEY) ? (getContext(KEY) as Session | null) : null
}

/** Throws instead of returning `null` — for components that only render inside a guarded, signed-in subtree. */
export function requireSessionContext(): Session {
  const session = getSessionContext()
  if (!session) {
    throw new Error('requireSessionContext() called outside a signed-in subtree')
  }
  return session
}
