import { describe, expect, it, vi } from 'vitest'
import { createKeepalivePoster } from '../src/beacon'

describe('createKeepalivePoster', () => {
  it('posts the payload as one keepalive JSON request with no credentials', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 202 }))
    const post = createKeepalivePoster({ endpoint: 'https://t.example/collect', fetchImpl })

    post({ events: [1, 2] })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0] ?? []
    expect(url).toBe('https://t.example/collect')
    expect(init).toMatchObject({
      method: 'POST',
      keepalive: true,
      credentials: 'omit',
      headers: { 'content-type': 'application/json' },
    })
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ events: [1, 2] })
  })

  it('never throws — not on a rejecting fetch, not on a throwing constructor', async () => {
    const rejecting = createKeepalivePoster({
      endpoint: 'https://t.example/collect',
      fetchImpl: vi.fn().mockRejectedValue(new Error('offline')),
    })
    expect(() => rejecting({ ok: true })).not.toThrow()
    await Promise.resolve()

    const throwing = createKeepalivePoster({
      endpoint: 'https://t.example/collect',
      fetchImpl: vi.fn(() => {
        throw new Error('blocked by policy')
      }),
    })
    expect(() => throwing({ ok: true })).not.toThrow()
  })
})
