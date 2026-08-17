import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearCache } from '../src/cache'
import { createQuery } from '../src/query.svelte'

beforeEach(() => {
  clearCache()
})

function waitForNot<T>(get: () => T, value: T): Promise<void> {
  return vi.waitFor(() => expect(get()).not.toBe(value))
}

describe('createQuery', () => {
  it('fetches on construction and exposes the result as .data', async () => {
    const fetcher = vi.fn().mockResolvedValue({ id: 1 })
    const query = createQuery('members', fetcher)

    await waitForNot(() => query.data, undefined)
    expect(query.data).toEqual({ id: 1 })
    expect(query.loading).toBe(false)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('serves a fresh cache entry without calling the fetcher again', async () => {
    const fetcher = vi.fn().mockResolvedValue('members-data')
    const first = createQuery('members', fetcher, { tenantId: 'acme', staleTime: 60_000 })
    await waitForNot(() => first.data, undefined)

    const second = createQuery('members', fetcher, { tenantId: 'acme', staleTime: 60_000 })

    expect(second.data).toBe('members-data')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('never serves cached data across tenants — a different tenantId is a cache miss', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce('acme-data').mockResolvedValueOnce('globex-data')
    const acme = createQuery('members', fetcher, { tenantId: 'acme' })
    await waitForNot(() => acme.data, undefined)

    const globex = createQuery('members', fetcher, { tenantId: 'globex' })
    await waitForNot(() => globex.data, undefined)

    expect(acme.data).toBe('acme-data')
    expect(globex.data).toBe('globex-data')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('refetch() forces a new fetch even when the cache is still fresh', async () => {
    const fetcher = vi.fn().mockResolvedValue('v1')
    const query = createQuery('members', fetcher, { staleTime: 60_000 })
    await waitForNot(() => query.data, undefined)

    fetcher.mockResolvedValueOnce('v2')
    await query.refetch()

    expect(query.data).toBe('v2')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('sets .error and leaves .data untouched when the fetcher rejects', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('network down'))
    const query = createQuery('members', fetcher)

    await waitForNot(() => query.error, null)
    expect((query.error as Error).message).toBe('network down')
    expect(query.data).toBeUndefined()
    expect(query.loading).toBe(false)
  })
})
