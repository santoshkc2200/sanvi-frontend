import type { components } from '@sanvi/api-client'

type ProviderView = components['schemas']['ProviderView']

export interface PaymentProviderAdapter {
  readonly kind: string
  connect(provider: ProviderView): Promise<void>
  status(provider: ProviderView): unknown
  manage(provider: ProviderView): Promise<void>
}

/**
 * The ONLY place that may branch on provider kind.
 *
 * Every consumer (PaymentsSettings, PaymentProviderCard, future status or
 * disconnect flows) obtains an adapter via `getProviderAdapter(kind)` and
 * calls its methods without ever checking the kind themselves. An unknown
 * kind degrades gracefully via the fallback adapter so a synthetic provider
 * added to a mocked catalog response still renders a card with no code change.
 */
const stripeAdapter: PaymentProviderAdapter = {
  kind: 'stripe_connect',
  async connect(_provider: ProviderView): Promise<void> {
    // TASK-003 will wire Connect.js + account session creation here.
  },
  status(_provider: ProviderView): unknown {
    return null
  },
  async manage(_provider: ProviderView): Promise<void> {
    // TASK-004/008 will use the embedded account_management component and dashboard link.
  },
}

const fakeAdapter: PaymentProviderAdapter = {
  kind: 'fake',
  async connect(_provider: ProviderView): Promise<void> {
    // Built against the backend fake provider; no Stripe credentials required.
  },
  status(_provider: ProviderView): unknown {
    return null
  },
  async manage(_provider: ProviderView): Promise<void> {},
}

function fallbackAdapter(kind: string): PaymentProviderAdapter {
  return {
    kind,
    async connect(_provider: ProviderView): Promise<void> {},
    status(_provider: ProviderView): unknown {
      return null
    },
    async manage(_provider: ProviderView): Promise<void> {},
  }
}

const registry = new Map<string, PaymentProviderAdapter>([
  [stripeAdapter.kind, stripeAdapter],
  [fakeAdapter.kind, fakeAdapter],
])

/**
 * Fallback provider views for the unentitled preview — derived from the
 * registry so the card list stays visible even when the catalog endpoint
 * 403s due to the missing `payments.stripe_connect` entitlement. This is
 * the only place that synthesizes provider views; no page branches on kind
 * to build them.
 */
export function getFallbackProviderViews(): ProviderView[] {
  const views: ProviderView[] = []
  for (const adapter of registry.values()) {
    if (adapter.kind === 'stripe_connect') {
      views.push({
        kind: 'stripe_connect',
        display_name: 'Stripe',
        available: true,
        requires_onboarding: true,
        supported_countries: ['US', 'JP', 'GB', 'DE'],
      })
    } else if (adapter.kind === 'fake') {
      views.push({
        kind: 'fake',
        display_name: 'Test provider',
        available: true,
        requires_onboarding: true,
        supported_countries: ['US', 'JP'],
      })
    } else {
      views.push({
        kind: adapter.kind,
        display_name: adapter.kind,
        available: true,
        requires_onboarding: true,
        supported_countries: [],
      })
    }
  }
  return views
}

export function registerProviderAdapter(adapter: PaymentProviderAdapter): void {
  registry.set(adapter.kind, adapter)
}

export function getProviderAdapter(kind: string): PaymentProviderAdapter {
  const found = registry.get(kind)
  if (found) return found
  return fallbackAdapter(kind)
}

export function hasProviderAdapter(kind: string): boolean {
  return registry.has(kind)
}

export function clearProviderAdaptersForTest(): void {
  registry.clear()
  registry.set(stripeAdapter.kind, stripeAdapter)
  registry.set(fakeAdapter.kind, fakeAdapter)
}

export type { ProviderView }
