import type { components, PaymentConnectionView } from '@sanvi/api-client'
import { createPaymentConnection } from '@sanvi/api-client'
import { getActiveTenantId } from '@sanvi/tenant'
import { apiClient } from '../api'

type ProviderView = components['schemas']['ProviderView']

let lastCreatedConnection: PaymentConnectionView | null = null

export function getLastCreatedPaymentConnection(): PaymentConnectionView | null {
  return lastCreatedConnection
}

export function clearLastCreatedPaymentConnection(): void {
  lastCreatedConnection = null
}

function persistConnectionId(tenantId: string | undefined, connectionId: string): void {
  if (!tenantId) return
  try {
    localStorage.setItem(`sanvi:payments:connection:${tenantId}`, connectionId)
  } catch {
    // ignore storage errors (e.g., SSR or quota)
  }
}

export function readPersistedConnectionId(tenantId: string | undefined): string | null {
  if (!tenantId) return null
  try {
    return localStorage.getItem(`sanvi:payments:connection:${tenantId}`)
  } catch {
    return null
  }
}

export function clearPersistedConnectionId(tenantId: string | undefined): void {
  if (!tenantId) return
  try {
    localStorage.removeItem(`sanvi:payments:connection:${tenantId}`)
  } catch {
    // ignore
  }
}

async function sharedConnect(provider: ProviderView): Promise<void> {
  const idempotencyKey = crypto.randomUUID()
  const connection = await createPaymentConnection(
    apiClient,
    { provider: provider.kind },
    idempotencyKey,
  )
  lastCreatedConnection = connection
  persistConnectionId(getActiveTenantId() ?? undefined, connection.id)
}

export interface ProviderStatus {
  connected: boolean
  detail?: string
}

export interface PaymentProviderAdapter {
  readonly kind: string
  connect(provider: ProviderView): Promise<void>
  status(provider: ProviderView): ProviderStatus | null
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
  connect: sharedConnect,
  status(_provider: ProviderView): ProviderStatus | null {
    return null
  },
  async manage(_provider: ProviderView): Promise<void> {
    // TASK-004/008 will use the embedded account_management component and dashboard link.
  },
}

const fakeAdapter: PaymentProviderAdapter = {
  kind: 'fake',
  connect: sharedConnect,
  status(_provider: ProviderView): ProviderStatus | null {
    return null
  },
  async manage(_provider: ProviderView): Promise<void> {},
}

function fallbackAdapter(kind: string): PaymentProviderAdapter {
  return {
    kind,
    async connect(_provider: ProviderView): Promise<void> {},
    status(_provider: ProviderView): ProviderStatus | null {
      return null
    },
    async manage(_provider: ProviderView): Promise<void> {},
  }
}

const registry = new Map<string, PaymentProviderAdapter>([
  [stripeAdapter.kind, stripeAdapter],
  [fakeAdapter.kind, fakeAdapter],
])

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

export type { ProviderView }
