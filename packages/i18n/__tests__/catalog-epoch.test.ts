import { mount, unmount } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import { registerAllSurfaces } from '../src/surfaces/all'
import { currentLocale, initI18n } from '../src/runtime.svelte'
import { ensureLocaleLoaded } from '../src/catalogs'
import EpochProbe from './fixtures/EpochProbe.svelte'

registerAllSurfaces()

describe('catalog epoch — late shards re-render locale text (TASK-022)', () => {
  it('a t() effect switches from the en fallback to ja once the lazy catalog lands', async () => {
    const seen: string[] = []
    const target = document.createElement('div')
    document.body.appendChild(target)
    const instance = mount(EpochProbe, {
      target,
      props: { onRender: (text: string) => seen.push(text) },
    })

    try {
      // ja is lazy: until its shards land, a render sees the base-locale
      // fallback — the hydration-time state the storefront's ja banner used
      // to get stuck in.
      initI18n({ locale: 'ja' })
      expect(currentLocale()).toBe('ja')
      await vi.waitFor(() => expect(seen.length).toBeGreaterThan(0))
      expect(seen[0]).toBe('We ask before we track')

      await ensureLocaleLoaded('ja')
      await vi.waitFor(() => {
        expect(seen[seen.length - 1]).not.toBe('We ask before we track')
      })
    } finally {
      await unmount(instance)
      target.remove()
    }
  }, 10_000)
})
