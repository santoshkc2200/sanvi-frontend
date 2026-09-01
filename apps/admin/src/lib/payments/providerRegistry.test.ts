import { describe, expect, it } from 'vitest'
import {
  getFallbackProviderViews,
  getProviderAdapter,
  hasProviderAdapter,
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
      status: () => 'custom-status',
      manage: async () => {},
    }
    registerProviderAdapter(custom)
    expect(hasProviderAdapter('custom_provider')).toBe(true)
    const retrieved = getProviderAdapter('custom_provider')
    expect(retrieved.kind).toBe('custom_provider')
    expect(retrieved.status({} as never)).toBe('custom-status')
  })

  it('exposes fallback provider views without branching outside registry', () => {
    const views = getFallbackProviderViews()
    expect(views.length).toBeGreaterThanOrEqual(2)
    expect(views.some((v) => v.kind === 'stripe_connect')).toBe(true)
  })
})
