import { beforeEach, describe, expect, it } from 'vitest'
import { load } from '../src/routes/checkout/return/+page'

function mockLoadEvent(url: URL) {
  return {
    url,
    params: {},
    route: { id: '/checkout/return' },
    data: {},
    fetch: globalThis.fetch,
    setHeaders: () => {},
    parent: async () => ({}),
    depends: () => {},
    untrack: <T>(fn: () => T): T => fn(),
  }
}

describe('checkout return +page.ts load function', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('prefers id search param over sessionStorage (Defect 1)', async () => {
    sessionStorage.setItem('sanvi_pending_checkout_id', 'chk_storage_123')

    const url = new URL('https://store.example.com/checkout/return?id=chk_url_456')
    const result = await load(mockLoadEvent(url))

    expect(result.checkoutId).toBe('chk_url_456')
  })

  it('prefers checkout_id search param over sessionStorage (Defect 1)', async () => {
    sessionStorage.setItem('sanvi_pending_checkout_id', 'chk_storage_123')

    const url = new URL('https://store.example.com/checkout/return?checkout_id=chk_url_789')
    const result = await load(mockLoadEvent(url))

    expect(result.checkoutId).toBe('chk_url_789')
  })

  it('falls back to sessionStorage when no URL param is present (Defect 1)', async () => {
    sessionStorage.setItem('sanvi_pending_checkout_id', 'chk_storage_123')

    const url = new URL('https://store.example.com/checkout/return')
    const result = await load(mockLoadEvent(url))

    expect(result.checkoutId).toBe('chk_storage_123')
  })

  it('resolves null when both URL params and sessionStorage are absent', async () => {
    const url = new URL('https://store.example.com/checkout/return')
    const result = await load(mockLoadEvent(url))

    expect(result.checkoutId).toBeNull()
  })
})
