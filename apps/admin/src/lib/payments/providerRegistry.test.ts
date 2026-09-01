import { describe, expect, it } from 'vitest'
import {
  clearLastCreatedPaymentConnection,
  clearPersistedConnectionId,
  getLastCreatedPaymentConnection,
  getProviderAdapter,
  hasProviderAdapter,
  readPersistedConnectionId,
  registerProviderAdapter,
} from './providerRegistry'

describe('payment provider registry', () => {
  it('returns stripe and fake adapters for known kinds', () => {
    expect(getProviderAdapter('stripe_connect').kind).toBe('stripe_connect')
    expect(getProviderAdapter('fake').kind).toBe('fake')
    expect(hasProviderAdapter('stripe_connect')).toBe(true)
    expect(hasProviderAdapter('fake')).toBe(true)
  })

  it('degrades gracefully for unknown kind', async () => {
    const adapter = getProviderAdapter('synthetic_paypal')
    expect(adapter.kind).toBe('synthetic_paypal')
    expect(hasProviderAdapter('synthetic_paypal')).toBe(false)
    // Should not throw
    await expect(adapter.connect({} as never)).resolves.toBeUndefined()
    expect(adapter.status({} as never)).toBeNull()
    await expect(adapter.manage({} as never)).resolves.toBeUndefined()
  })

  it('registers a new adapter and makes it retrievable by kind', async () => {
    const custom = {
      kind: 'custom_provider',
      connect: async () => {},
      status: () => ({ connected: true, detail: 'custom-status' }),
      manage: async () => {},
    }
    registerProviderAdapter(custom)
    expect(hasProviderAdapter('custom_provider')).toBe(true)
    const retrieved = getProviderAdapter('custom_provider')
    expect(retrieved.kind).toBe('custom_provider')
    expect(retrieved.status({} as never)).toEqual({ connected: true, detail: 'custom-status' })
  })
  it('manages persisted connection id per tenant and clears it', () => {
    localStorage.setItem('sanvi:payments:connection:tenant-1', 'conn-1')
    expect(readPersistedConnectionId('tenant-1')).toBe('conn-1')
    expect(readPersistedConnectionId('tenant-2')).toBeNull()

    clearPersistedConnectionId('tenant-1')
    expect(readPersistedConnectionId('tenant-1')).toBeNull()
  })

  it('manages lastCreatedConnection singleton and clears it', () => {
    clearLastCreatedPaymentConnection()
    expect(getLastCreatedPaymentConnection()).toBeNull()
  })
})
