import { describe, expect, it, vi } from 'vitest'
import { prefetchOnIntent, shouldPrefetch } from '../src/prefetch'

describe('shouldPrefetch — the Save-Data / slow-connection guard', () => {
  it('allows prefetch on a healthy connection', () => {
    expect(shouldPrefetch({ saveData: false, effectiveType: '4g' })).toBe(true)
  })

  it('never prefetches under Save-Data, whatever the connection class', () => {
    expect(shouldPrefetch({ saveData: true, effectiveType: '4g' })).toBe(false)
  })

  it('never prefetches on a slow connection (2g class)', () => {
    expect(shouldPrefetch({ saveData: false, effectiveType: 'slow-2g' })).toBe(false)
    expect(shouldPrefetch({ saveData: false, effectiveType: '2g' })).toBe(false)
  })

  it('prefetches on 3g/4g with no Save-Data request', () => {
    expect(shouldPrefetch({ effectiveType: '3g' })).toBe(true)
  })

  it('allows when the Network Information API is absent (Safari/Firefox) or silent', () => {
    expect(shouldPrefetch(undefined)).toBe(true)
    expect(shouldPrefetch({})).toBe(true)
  })
})

describe('prefetchOnIntent — the Svelte action', () => {
  it('fires the loader on pointerenter and detaches after the first fire', () => {
    const node = document.createElement('a')
    const loader = vi.fn()
    prefetchOnIntent(node, loader)

    node.dispatchEvent(new Event('pointerenter'))
    node.dispatchEvent(new Event('pointerenter'))
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('fires the loader on keyboard focus (focusin)', () => {
    const node = document.createElement('a')
    const loader = vi.fn()
    prefetchOnIntent(node, loader)

    node.dispatchEvent(new Event('focusin'))
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('does not fire under Save-Data — the guard is checked at event time', () => {
    const node = document.createElement('a')
    const loader = vi.fn()
    prefetchOnIntent(node, loader)

    // jsdom's navigator has no `connection`; define it the way the browser
    // would expose it so `shouldPrefetch()` reads the Save-Data request.
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: { saveData: true, effectiveType: '4g' },
    })
    try {
      node.dispatchEvent(new Event('pointerenter'))
      expect(loader).not.toHaveBeenCalled()
    } finally {
      Object.defineProperty(navigator, 'connection', {
        configurable: true,
        value: undefined,
      })
    }
  })

  it('stops listening on destroy', () => {
    const node = document.createElement('a')
    const loader = vi.fn()
    const action = prefetchOnIntent(node, loader)
    action.destroy()

    node.dispatchEvent(new Event('pointerenter'))
    expect(loader).not.toHaveBeenCalled()
  })
})
