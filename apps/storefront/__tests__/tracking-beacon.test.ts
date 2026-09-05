import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CheckoutView } from '../src/lib/checkout/types'
import {
  recordConversionOnce,
  resetConversionTrackerForTesting,
} from '../src/lib/checkout/conversion'

type BeaconModule = typeof import('../src/lib/tracking/beacon')

/**
 * The env mock module is re-evaluated after `vi.resetModules`, so the site
 * key must be written on the *fresh* instance (re-imported after the reset)
 * before importing the beacon — `getAppEnv()` caches on first call, which
 * pins the transport choice for the module instance under test.
 */
async function loadBeaconModule(siteKey?: string): Promise<BeaconModule> {
  vi.resetModules()
  const envModule = await import('./mocks/env-dynamic-public')
  envModule.env['PUBLIC_TRACKING_SITE_KEY'] = siteKey
  return await import('../src/lib/tracking/beacon')
}

const paidCheckout: CheckoutView = {
  id: 'chk_1',
  amount_minor: 4800,
  currency: 'USD',
  reference: 'ord-1',
  status: 'paid',
  conversion_event_id: 'conv_server_issued_1',
  created_at: new Date().toISOString(),
}

function defineSendBeacon(impl: (...args: unknown[]) => boolean): ReturnType<typeof vi.fn> {
  const sendBeacon = vi.fn(impl)
  Object.defineProperty(window.navigator, 'sendBeacon', {
    value: sendBeacon,
    configurable: true,
  })
  return sendBeacon
}

describe('purchase beacon payload', () => {
  beforeEach(() => {
    resetConversionTrackerForTesting()
    window.sessionStorage.clear()
  })

  it('carries the server-issued event id verbatim — never a minted one', async () => {
    const { buildPurchaseBeacon } = await loadBeaconModule()

    const payload = buildPurchaseBeacon(paidCheckout, paidCheckout.conversion_event_id!)

    expect(payload.event_id).toBe('conv_server_issued_1')
    expect(payload.event_name).toBe('purchase')
    expect(payload.value).toBe(4800)
    expect(payload.currency).toBe('USD')
    expect(payload.order_ref).toBe('ord-1')
  })

  it('carries the stashed landing click ids when present', async () => {
    const { buildPurchaseBeacon } = await loadBeaconModule()
    window.sessionStorage.setItem(
      'sanvi_ads_landing_click_ids',
      JSON.stringify({ ids: { gclid: 'g-1' }, captured_at: '2026-09-05T00:00:00Z' }),
    )

    const payload = buildPurchaseBeacon(paidCheckout, 'conv_1')

    expect(payload.click_ids?.gclid).toBe('g-1')
    expect(payload.click_ids?.capture_time).toBe('2026-09-05T00:00:00Z')
  })
})

describe('beacon transport', () => {
  beforeEach(() => {
    resetConversionTrackerForTesting()
    vi.unstubAllGlobals()
    Reflect.deleteProperty(window.navigator as unknown as Record<string, unknown>, 'sendBeacon')
  })

  it('uses fetch keepalive with the X-Site-Key header when a site key is configured', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    const sendBeacon = defineSendBeacon(() => true)
    const { fireConversionBeacon, buildPurchaseBeacon } = await loadBeaconModule('site-key-1')

    fireConversionBeacon(buildPurchaseBeacon(paidCheckout, 'conv_1'))
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit & { headers: Record<string, string> },
    ]
    expect(url).toContain('/api/v1/public/track')
    expect(init.keepalive).toBe(true)
    expect(init.headers['X-Site-Key']).toBe('site-key-1')
    expect(JSON.parse(String(init.body)).event_id).toBe('conv_1')
    expect(sendBeacon).not.toHaveBeenCalled()
  })

  it('does not emit at all when no site key is configured — the rollback gate', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    const sendBeacon = defineSendBeacon(() => true)
    const { fireConversionBeacon, buildPurchaseBeacon } = await loadBeaconModule(undefined)

    fireConversionBeacon(buildPurchaseBeacon(paidCheckout, 'conv_1'))
    await new Promise((resolve) => setTimeout(resolve, 0))

    // A headerless beacon can never pass the backend's site-key check, so
    // the page does not fire one: emission is gated on the same switch that
    // governs capture (`advertising.conversion_tracking` off → nothing
    // sent, nothing queued).
    expect(sendBeacon).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('swallows a network failure — the beacon is fire-and-forget', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('offline'))),
    )
    const { fireConversionBeacon, buildPurchaseBeacon } = await loadBeaconModule('site-key-1')

    expect(() => fireConversionBeacon(buildPurchaseBeacon(paidCheckout, 'conv_1'))).not.toThrow()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

  it('a refresh of the confirmation page fires no second beacon', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    const { fireConversionBeacon, buildPurchaseBeacon } = await loadBeaconModule('site-key-1')

    const reporter = (id: string) => {
      fireConversionBeacon(buildPurchaseBeacon(paidCheckout, id))
    }

    expect(recordConversionOnce('conv_once_1', reporter)).toBe(true)
    expect(recordConversionOnce('conv_once_1', reporter)).toBe(false)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
  })
})
