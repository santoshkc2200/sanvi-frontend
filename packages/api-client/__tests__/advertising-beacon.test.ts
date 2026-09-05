import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendConversionBeacon } from '../src/advertising'

/**
 * The conversion beacon's transport priority (TASK-014). The backend
 * authenticates `/public/track` with an `X-Site-Key` header that
 * `navigator.sendBeacon` cannot carry, so a site key forces the
 * header-bearing `fetch` with `keepalive`; `sendBeacon` is the fallback for
 * a (currently hypothetical) header-less deployment. Node has no
 * `navigator`, so each scenario stubs the globals it needs.
 */

const body = {
  event_id: 'conv-1',
  event_name: 'purchase',
  value: 4800,
  currency: 'JPY',
}

function stubNavigator(sendBeacon?: (url: string, data: unknown) => boolean): void {
  vi.stubGlobal('navigator', sendBeacon ? { sendBeacon } : (globalThis.navigator ?? {}))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('sendConversionBeacon transport', () => {
  it('uses fetch keepalive with the X-Site-Key header when a site key is given', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    const sendBeacon = vi.fn(() => true)
    stubNavigator(sendBeacon)

    const sent = await sendConversionBeacon({
      url: 'https://shop.example.test/api/v1/public/track',
      body,
      siteKey: 'key-1',
    })

    expect(sent).toBe(true)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit & { headers: Record<string, string> },
    ]
    expect(url).toBe('https://shop.example.test/api/v1/public/track')
    expect(init.method).toBe('POST')
    expect(init.keepalive).toBe(true)
    expect(init.headers['X-Site-Key']).toBe('key-1')
    expect(JSON.parse(String(init.body))).toEqual(body)
    expect(sendBeacon).not.toHaveBeenCalled()
  })

  it('uses sendBeacon when no site key is given and the API exists', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    const sendBeacon = vi.fn(() => true)
    stubNavigator(sendBeacon)

    const sent = await sendConversionBeacon({
      url: 'https://shop.example.test/api/v1/public/track',
      body,
    })

    expect(sent).toBe(true)
    const [url, blob] = sendBeacon.mock.calls[0] as unknown as [string, Blob]
    expect(url).toBe('https://shop.example.test/api/v1/public/track')
    expect(JSON.parse(await blob.text())).toEqual(body)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('falls back to fetch without the header when sendBeacon is unavailable', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    stubNavigator(undefined)

    const sent = await sendConversionBeacon({
      url: 'https://shop.example.test/api/v1/public/track',
      body,
    })

    expect(sent).toBe(true)
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit & { headers: Record<string, string> },
    ]
    expect(init.headers['X-Site-Key']).toBeUndefined()
  })

  it('answers false — never throws — when the send fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('offline'))),
    )

    await expect(
      sendConversionBeacon({
        url: 'https://shop.example.test/api/v1/public/track',
        body,
        siteKey: 'key-1',
      }),
    ).resolves.toBe(false)
  })

  it('answers false when no transport exists at all', async () => {
    stubNavigator(undefined)
    vi.stubGlobal('fetch', undefined)

    await expect(
      sendConversionBeacon({ url: 'https://shop.example.test/api/v1/public/track', body }),
    ).resolves.toBe(false)
  })
})
