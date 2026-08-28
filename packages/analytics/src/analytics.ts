import type { ConsentStore } from '@sanvi/consent'
import type { ProcessingPurpose } from '@sanvi/consent'

/**
 * Directive-aware tracking.
 *
 * The one rule this package exists to enforce: **an event whose purpose is
 * not `allowed` is dropped, not queued.** A queue that flushes on a later
 * permission would be retroactive collection — the exact failure the
 * phase-05 plan calls out. The gate reads the resolved directive, so the
 * same call is blocked by an EU absence-of-consent and by a California
 * opt-out without the caller knowing (or needing to know) which.
 *
 * Payloads are flat and schema-checked, and known-PII prop names are
 * rejected outright — analytics events never carry personal data.
 */

export interface AnalyticsEvent {
  event: string
  props: Record<string, unknown>
  purpose: ProcessingPurpose
  timestamp: number
}

/** Where accepted events go. Real adapters (phase 10's storefront beacon) implement this. */
export type AnalyticsSink = (event: AnalyticsEvent) => void

export type DropReason = 'purpose-not-allowed' | 'pii-prop' | 'invalid-payload'

export interface AnalyticsOptions {
  store: ConsentStore
  sink: AnalyticsSink
  now?: () => number
  /** Observability hook for tests and the debug log — never a re-queue path. */
  onDrop?: (event: string, purpose: ProcessingPurpose, reason: DropReason) => void
}

/**
 * A third-party integration adapter. `purposes` lists everything the
 * integration needs — ad and audience integrations include
 * `sale_or_share`/`targeted_advertising`, which is what makes a US opt-out
 * more than a UI gesture for them.
 */
export interface AnalyticsIntegration {
  id: string
  purposes: readonly ProcessingPurpose[]
  /** Called once, the first time all purposes become allowed. */
  init: () => void
  /** Called on every directive change while active — integrations re-read limits here. */
  onDirectiveChange?: (allowed: boolean) => void
  /** Revocation cleanup: drop buffers, remove cookies the integration set. */
  revoke: () => void
}

/** Prop names that must never appear in an analytics payload. */
export const KNOWN_PII_PROPS: readonly string[] = [
  'email',
  'name',
  'full_name',
  'first_name',
  'last_name',
  'phone',
  'phone_number',
  'address',
  'street_address',
  'postal_code',
  'ssn',
  'tax_id',
  'credit_card',
  'card_number',
  'ip',
  'ip_address',
  'dob',
  'birth_date',
  'birth_year',
  'password',
  'token',
  'session_id',
  'user_id',
]

const ALLOWED_PROP_TYPES = new Set(['string', 'number', 'boolean'])

export class PiiViolationError extends Error {
  constructor(readonly prop: string) {
    super(`Analytics payload contains a known-PII prop: "${prop}"`)
    this.name = 'PiiViolationError'
  }
}

export interface SanviAnalytics {
  /**
   * Tracks one event for `purpose` (default `analytics`). Dropped when the
   * purpose's directive is not `allowed` — there is no queue and no replay.
   */
  track(event: string, props?: Record<string, unknown>, purpose?: ProcessingPurpose): void
  /** Whether events for `purpose` currently pass the gate. */
  isEnabled(purpose: ProcessingPurpose): boolean
  /** Registers an integration, initializing it only if its purposes are allowed right now. */
  registerIntegration(integration: AnalyticsIntegration): () => void
  /** Test/diagnostic count of dropped events since creation. */
  droppedCount(): number
  dispose(): void
}

export function createAnalytics(options: AnalyticsOptions): SanviAnalytics {
  const { store, sink } = options
  const now = options.now ?? Date.now
  let drops = 0
  let disposed = false
  const integrations = new Map<string, { integration: AnalyticsIntegration; active: boolean }>()

  function integrationAllowed(integration: AnalyticsIntegration): boolean {
    return integration.purposes.every((purpose) => store.isAllowed(purpose))
  }

  function syncIntegration(entry: { integration: AnalyticsIntegration; active: boolean }): void {
    const allowed = integrationAllowed(entry.integration)
    if (allowed && !entry.active) {
      entry.active = true
      entry.integration.init()
    } else if (!allowed && entry.active) {
      entry.active = false
      entry.integration.revoke()
    }
    if (entry.active) entry.integration.onDirectiveChange?.(allowed)
  }

  const unsubscribe = store.subscribe(() => {
    if (disposed) return
    // Directive changes propagate synchronously — revocation cleanup happens
    // in the same tick as the decision, not on the next flush.
    for (const entry of integrations.values()) syncIntegration(entry)
  })

  const analytics: SanviAnalytics = {
    track(event, props = {}, purpose = 'analytics') {
      if (disposed) return
      if (!store.isAllowed(purpose)) {
        drops += 1
        options.onDrop?.(event, purpose, 'purpose-not-allowed')
        return // dropped, not queued — no retroactive collection
      }
      if (typeof event !== 'string' || event.length === 0 || event.length > 128) {
        drops += 1
        options.onDrop?.(event, purpose, 'invalid-payload')
        return
      }
      for (const [key, value] of Object.entries(props)) {
        if (KNOWN_PII_PROPS.includes(key.toLowerCase())) {
          // A PII prop is a developer mistake, not a privacy outcome — fail
          // loudly rather than strip quietly and hide the bug.
          throw new PiiViolationError(key)
        }
        const valueType = value === null ? 'null' : typeof value
        if (value !== null && !ALLOWED_PROP_TYPES.has(valueType)) {
          drops += 1
          options.onDrop?.(event, purpose, 'invalid-payload')
          return
        }
      }
      sink({ event, props, purpose, timestamp: now() })
    },

    isEnabled(purpose) {
      return store.isAllowed(purpose)
    },

    registerIntegration(integration) {
      const entry = { integration, active: false }
      integrations.set(integration.id, entry)
      syncIntegration(entry)
      return () => {
        if (entry.active) {
          entry.integration.revoke()
          entry.active = false
        }
        integrations.delete(integration.id)
      }
    },

    droppedCount() {
      return drops
    },

    dispose() {
      disposed = true
      for (const entry of integrations.values()) {
        if (entry.active) {
          entry.integration.revoke()
          entry.active = false
        }
      }
      unsubscribe()
    },
  }

  return analytics
}
