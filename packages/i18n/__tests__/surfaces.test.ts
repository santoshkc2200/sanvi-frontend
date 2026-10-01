import { describe, expect, it, vi } from 'vitest'
import { ensureLocaleLoaded, en, isJaLoaded, messages } from '../src/catalogs'
import { hasMessage, t } from '../src/translate'

/**
 * Surface loading in a fresh module registry (Vitest isolates each test
 * file): the registrar is imported *dynamically inside* the tests so the
 * pre-registration state is observable, exactly as an app's boot would see
 * it — nothing is registered until the app's boot calls its registrar.
 */
describe('catalog surfaces', () => {
  it('nothing is loadable before a surface registers — keys are unknown', () => {
    expect(hasMessage('storefront.home.fallbackTitle')).toBe(false)
    expect('admin.app.brand' in en).toBe(false)
  })

  it('registering a surface merges its shards into the live `en` view', async () => {
    const { registerStorefrontSurface } = await import('../src/surfaces/storefront')
    registerStorefrontSurface()

    expect(hasMessage('storefront.home.fallbackTitle')).toBe(true)
    expect(hasMessage('consent.banner.title')).toBe(true)
    expect(t['storefront.home.fallbackTitle']()).toBe(messages.en['storefront.home.fallbackTitle'])
    // Foreign shards stay out — the whole point of TASK-032.
    expect(hasMessage('admin.app.brand')).toBe(false)
    expect(hasMessage('marketing.home.title')).toBe(false)
  })

  it('an unloaded shard behaves exactly like an unknown key: loud, and the key itself', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    // @ts-expect-error — exercising the unloaded-shard path on purpose
    expect(t['admin.app.brand']()).toBe('admin.app.brand')
    expect(errorSpy).toHaveBeenCalledOnce()
    errorSpy.mockRestore()
  })

  it("ensureLocaleLoaded('ja') fetches only the registered surface's ja shards", async () => {
    const { registerStorefrontSurface } = await import('../src/surfaces/storefront')
    registerStorefrontSurface()
    await ensureLocaleLoaded('ja')

    expect(isJaLoaded()).toBe(true)
    expect(messages.ja?.['storefront.home.fallbackTitle']).toBe('Sanvi ストアフロント')
    expect(messages.ja?.['admin.app.brand']).toBeUndefined()
  })

  it('registration is idempotent — a second call neither duplicates nor extends', async () => {
    const { registerMarketingSurface } = await import('../src/surfaces/marketing')
    registerMarketingSurface()
    const keys = Object.keys(en).length
    registerMarketingSurface()
    expect(Object.keys(en).length).toBe(keys)
    // A different surface still adds its own shards afterwards.
    const { registerAdminSurface } = await import('../src/surfaces/admin')
    registerAdminSurface()
    expect(Object.keys(en).length).toBeGreaterThan(keys)
  })
})
