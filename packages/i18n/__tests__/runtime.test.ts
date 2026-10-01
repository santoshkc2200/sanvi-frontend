import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerAllSurfaces } from '../src/surfaces/all'
import { currentLocale, initI18n, locale, onLocaleChange, setLocale } from '../src/runtime.svelte'

registerAllSurfaces()
import { isPseudoMode, pseudoize, setPseudoMode } from '../src/pseudo'
import { t } from '../src/translate'

describe('runtime store', () => {
  afterEach(() => {
    document.cookie = 'sanvi_locale=; path=/; max-age=0'
    setPseudoMode(false)
    void setLocale('en')
  })

  it('setLocale validates against the configured set', async () => {
    await expect(setLocale('de')).rejects.toThrow(TypeError)
  })

  it('setLocale updates the store, the cookie and <html lang>', async () => {
    await setLocale('ja')
    expect(currentLocale()).toBe('ja')
    expect(document.documentElement.lang).toBe('ja')
    expect(document.cookie).toContain('sanvi_locale=ja')
  })

  it('notifies onLocaleChange listeners and supports disposers', async () => {
    const seen: string[] = []
    const off = onLocaleChange((l) => seen.push(l))
    await setLocale('ja')
    off()
    await setLocale('en')
    expect(seen).toEqual(['ja'])
  })

  it('the `locale` store view pushes the current value on subscribe and on change', async () => {
    const seen: string[] = []
    const unsubscribe = locale.subscribe((l) => seen.push(l))
    await setLocale('ja')
    unsubscribe()
    expect(seen).toContain('en')
    expect(seen).toContain('ja')
  })

  it('initI18n seeds the store from a negotiated value before first render', () => {
    initI18n({ locale: 'ja-JP' })
    expect(currentLocale()).toBe('ja')
    initI18n({ locale: 'not-a-locale' })
    expect(currentLocale()).toBe('ja') // junk is ignored, store unchanged
  })

  it('initI18n toggles pseudo mode', () => {
    initI18n({ pseudo: true })
    expect(isPseudoMode()).toBe(true)
    initI18n({ pseudo: false })
    expect(isPseudoMode()).toBe(false)
  })
})

describe('t', () => {
  afterEach(() => {
    void setLocale('en')
    vi.restoreAllMocks()
  })

  it('renders the catalog message for the current locale', async () => {
    await setLocale('en')
    expect(t['marketing.home.cta']()).toBe('Get started')
    await setLocale('ja')
    expect(t['marketing.home.cta']()).toBe('始める')
  })

  it('passes params through the ICU pattern', () => {
    expect(t['marketing.home.cta']()).toBe('Get started')
  })

  it('renders the key itself (loudly) for unknown keys', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    // @ts-expect-error — deliberately exercising the runtime's unknown-key path
    expect(t['no.such.key']()).toBe('no.such.key')
    expect(errorSpy).toHaveBeenCalledOnce()
  })

  it('applies pseudo-localisation when enabled', async () => {
    await setLocale('en')
    setPseudoMode(true)
    const pseudo = t['marketing.home.cta']()
    expect(pseudo.startsWith('[Ğééť')).toBe(true) // "Get" accented + doubled vowel
    expect(pseudo.endsWith(']')).toBe(true)
    expect(pseudo.length).toBeGreaterThan('Get started'.length + 2)
    expect(pseudoize('')).toBe('[]')
  })
})
