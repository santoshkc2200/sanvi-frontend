import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cacheKey, clearCache, getCacheEntry, setCacheEntry } from '../src/cache'
import { createMutation } from '../src/mutation.svelte'

beforeEach(() => {
  clearCache()
})

describe('createMutation', () => {
  it('calls the mutation function with its arguments and returns the result', async () => {
    const fn = vi.fn().mockResolvedValue({ id: 'new' })
    const mutation = createMutation((name: string) => fn(name))

    const result = await mutation.mutate('Acme')

    expect(fn).toHaveBeenCalledWith('Acme')
    expect(result).toEqual({ id: 'new' })
    expect(mutation.loading).toBe(false)
    expect(mutation.error).toBeNull()
  })

  it('invalidates the configured tags on success', async () => {
    setCacheEntry(cacheKey('acme', 'members'), 'stale', ['members'])
    const mutation = createMutation(async () => 'ok', { invalidates: ['members'] })

    await mutation.mutate()

    expect(getCacheEntry(cacheKey('acme', 'members'))).toBeUndefined()
  })

  it('runs onMutate before the call and onError (not invalidation) when it rejects', async () => {
    setCacheEntry(cacheKey('acme', 'members'), 'still-here', ['members'])
    const onMutate = vi.fn()
    const onError = vi.fn()
    const mutation = createMutation(
      async () => {
        throw new Error('validation failed')
      },
      { invalidates: ['members'], onMutate, onError },
    )

    await expect(mutation.mutate()).rejects.toThrow('validation failed')

    expect(onMutate).toHaveBeenCalledOnce()
    expect(onError).toHaveBeenCalledWith(expect.any(Error))
    expect(mutation.error).toBeInstanceOf(Error)
    expect(getCacheEntry(cacheKey('acme', 'members'))?.data).toBe('still-here') // no invalidation on failure
  })

  it('sets loading true only while the mutation is in flight', async () => {
    let resolveFn: (() => void) | undefined
    const fn = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveFn = resolve
        }),
    )
    const mutation = createMutation(fn)

    const pending = mutation.mutate()
    expect(mutation.loading).toBe(true)

    resolveFn?.()
    await pending

    expect(mutation.loading).toBe(false)
  })
})
