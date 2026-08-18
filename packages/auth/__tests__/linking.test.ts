import type { TypedApiClient } from '@sanvi/api-client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { abandonLinking, completeLinking, getPendingLink, startLinking } from '../src/linking'

function fakeTypedClient(
  overrides: Partial<{ POST: TypedApiClient['POST'] }> = {},
): TypedApiClient {
  return {
    GET: vi.fn(),
    POST: overrides.POST ?? vi.fn(),
    PUT: vi.fn(),
    PATCH: vi.fn(),
    DELETE: vi.fn(),
  } as unknown as TypedApiClient
}

describe('linking', () => {
  afterEach(() => {
    abandonLinking()
    vi.useRealTimers()
  })

  it('has no pending link before startLinking is called', () => {
    expect(getPendingLink()).toBeUndefined()
  })

  it('holds the nonce returned by the challenge after startLinking', async () => {
    const post = vi.fn().mockResolvedValue({ nonce: 'nonce-abc', expires_in_secs: 600 })
    await startLinking(fakeTypedClient({ POST: post }), {
      provider: 'google',
      subject: 'sub-1',
      email: 'alice@example.com',
    })

    expect(post).toHaveBeenCalledWith(
      '/api/v1/auth/link/challenge',
      { provider: 'google', subject: 'sub-1', email: 'alice@example.com', kratos_flow_id: null },
      undefined,
    )
    expect(getPendingLink()).toMatchObject({ provider: 'google', nonce: 'nonce-abc' })
  })

  it('abandonLinking discards the pending challenge without calling the backend', async () => {
    const post = vi.fn().mockResolvedValue({ nonce: 'n', expires_in_secs: 600 })
    await startLinking(fakeTypedClient({ POST: post }), {
      provider: 'google',
      subject: 'sub-1',
      email: 'a@example.com',
    })

    abandonLinking()

    expect(getPendingLink()).toBeUndefined()
  })

  it('completeLinking sends the held nonce and clears the pending state', async () => {
    const post = vi
      .fn()
      .mockResolvedValueOnce({ nonce: 'nonce-abc', expires_in_secs: 600 })
      .mockResolvedValueOnce({ provider: 'google', subject: 'sub-1', linked: true })
    const client = fakeTypedClient({ POST: post })

    await startLinking(client, { provider: 'google', subject: 'sub-1', email: 'a@example.com' })
    const result = await completeLinking(client)

    expect(post).toHaveBeenLastCalledWith(
      '/api/v1/auth/link/complete',
      { nonce: 'nonce-abc' },
      undefined,
    )
    expect(result).toEqual({ provider: 'google', subject: 'sub-1', linked: true })
    expect(getPendingLink()).toBeUndefined()
  })

  it('completeLinking throws when there is nothing pending', async () => {
    await expect(completeLinking(fakeTypedClient())).rejects.toThrow(/no pending link challenge/)
  })

  it('completeLinking throws and clears state once the challenge has expired', async () => {
    vi.useFakeTimers()
    const post = vi.fn().mockResolvedValue({ nonce: 'nonce-abc', expires_in_secs: 1 })
    const client = fakeTypedClient({ POST: post })

    await startLinking(client, { provider: 'google', subject: 'sub-1', email: 'a@example.com' })
    vi.advanceTimersByTime(2_000)

    await expect(completeLinking(client)).rejects.toThrow(/expired/)
    expect(getPendingLink()).toBeUndefined()
  })
})
