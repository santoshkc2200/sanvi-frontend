import { ConsentStore, createScriptGate } from '@sanvi/consent'
import type { ConsentModel, DirectiveSnapshot } from '@sanvi/consent'
import { limitSensitiveUse, recordOptOut, updateConsent } from '@sanvi/api-client'
import { apiClient } from './auth'

/**
 * Browser-side consent state, created once per page load from the
 * server-resolved privacy context (the root layout's server load). The
 * store itself is framework-free; this module is the thin bridge that
 * wires its server sync to `@sanvi/api-client` and exposes it to routes.
 *
 * Reactivity lives in `consentState`: the store is a singleton, so a
 * `$derived` returning the object itself would never re-run (same
 * reference). Components instead read `consentState.ready` /
 * `consentState.version` — plain values that actually change — and pull
 * the decision state off the singleton inside the same derivation.
 */

export const consentState = $state({ ready: false, version: 0 })

let store: ConsentStore | null = null

export interface PrivacyData {
  snapshot: DirectiveSnapshot
  model: ConsentModel
  noticeAtCollectionVersion?: string | null
}

export function initConsent(privacy: PrivacyData): ConsentStore {
  if (store) return store
  store = new ConsentStore({
    snapshot: privacy.snapshot,
    consentModel: privacy.model,
    doc: typeof document !== 'undefined' ? document : undefined,
    locale: typeof navigator !== 'undefined' ? navigator.language : undefined,
    gpc:
      typeof navigator !== 'undefined' &&
      (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true,
    noticeAtCollectionVersion: privacy.noticeAtCollectionVersion ?? null,
    sync: {
      consent: (change) => updateConsent(apiClient, change),
      optOut: (command) => recordOptOut(apiClient, command),
      limitSensitive: (body) => limitSensitiveUse(apiClient, body),
    },
  })
  store.subscribe(() => {
    // Runs from the store's own emit — event handlers and promise
    // callbacks, never inside a tracked effect, so this write is safe.
    consentState.version += 1
  })
  return store
}

/** Marks the store as available. Call once, from the root layout's effect. */
export function markConsentReady(): void {
  consentState.ready = true
}

export function getConsent(): ConsentStore | null {
  return store
}

/**
 * The storefront's gated script — proof that nothing non-essential loads
 * before the directive allows it. The gate subscribes to the store, so a
 * revocation removes the element and fires `sanvi:consent-script-revoked`.
 */
const GATED_SCRIPT_SRC = '/mock-analytics.js'

export function initGatedAnalytics(): void {
  const active = getConsent()
  if (!active || typeof document === 'undefined') return
  const gate = createScriptGate({ store: active, allowList: [GATED_SCRIPT_SRC] })
  gate.load({ src: GATED_SCRIPT_SRC, purposes: ['analytics'] }).catch(() => {
    // Blocked is the normal path before a choice (or after a refusal).
  })
}
