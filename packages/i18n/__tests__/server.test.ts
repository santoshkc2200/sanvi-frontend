import { beforeAll, describe, expect, it } from 'vitest'
import { ensureLocaleLoaded } from '../src/catalogs'
import { t } from '../src/translate'
import { resolveRequestLocale, runWithLocale } from '../src/server'

describe('resolveRequestLocale — the detection-chain matrix', () => {
  const base = {
    pathname: '/privacy',
  }

  it('1. URL prefix wins over everything', () => {
    const result = resolveRequestLocale({
      ...base,
      pathname: '/ja/privacy',
      cookieLocale: 'en',
      sessionLocale: 'en',
      tenantDefaultLocale: 'en',
      acceptLanguage: 'en',
    })
    expect(result).toEqual({ locale: 'ja', source: 'url' })
  })

  it('2. cookie is the device-level explicit choice', () => {
    const result = resolveRequestLocale({
      ...base,
      cookieLocale: 'ja',
      sessionLocale: 'en',
      tenantDefaultLocale: 'en',
    })
    expect(result).toEqual({ locale: 'ja', source: 'cookie' })
  })

  it('3. session (account preference) outranks tenant default', () => {
    const result = resolveRequestLocale({ ...base, sessionLocale: 'ja', tenantDefaultLocale: 'en' })
    expect(result).toEqual({ locale: 'ja', source: 'session' })
  })

  it('4. tenant default outranks Accept-Language', () => {
    const result = resolveRequestLocale({
      ...base,
      tenantDefaultLocale: 'ja',
      acceptLanguage: 'en',
    })
    expect(result).toEqual({ locale: 'ja', source: 'tenant' })
  })

  it('5. Accept-Language is the last real signal', () => {
    const result = resolveRequestLocale({ ...base, acceptLanguage: 'ja-JP,ja;q=0.9,en;q=0.8' })
    expect(result).toEqual({ locale: 'ja', source: 'accept-language' })
  })

  it('6. base locale is the floor', () => {
    const result = resolveRequestLocale({ ...base, acceptLanguage: 'de-DE' })
    expect(result).toEqual({ locale: 'en', source: 'base' })
    expect(resolveRequestLocale({})).toEqual({ locale: 'en', source: 'base' })
  })

  it('invalid locale values are never trusted — any leg can carry junk', () => {
    expect(resolveRequestLocale({ ...base, cookieLocale: '../../etc' }).source).not.toBe('cookie')
    expect(resolveRequestLocale({ ...base, sessionLocale: 'x"onload="' }).source).not.toBe(
      'session',
    )
    expect(resolveRequestLocale({ ...base, tenantDefaultLocale: '"ja"' }).source).toBe('base')
    expect(resolveRequestLocale({ ...base, pathname: '/../../etc/passwd' }).source).toBe('base')
  })

  it('an unavailable prefix falls through to the rest of the chain', () => {
    const result = resolveRequestLocale({
      pathname: '/ja/privacy',
      available: ['en'],
      acceptLanguage: 'en',
    })
    expect(result).toEqual({ locale: 'en', source: 'accept-language' })
  })
})

describe('runWithLocale (AsyncLocalStorage)', () => {
  beforeAll(async () => {
    await ensureLocaleLoaded('ja')
  })

  it('scopes t() to the request inside the run', async () => {
    const ja = runWithLocale('ja', () => t['marketing.home.cta']())
    const en = runWithLocale('en', () => t['marketing.home.cta']())
    expect(ja).toBe('始める')
    expect(en).toBe('Get started')
  })

  it('keeps concurrent requests isolated — no cross-request bleed through the module global', async () => {
    const results: string[] = []

    const request = async (locale: 'en' | 'ja', delayMs: number): Promise<void> => {
      await runWithLocale(locale, async () => {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
        results.push(t['marketing.home.cta']())
      })
    }

    // Interleave deliberately: the ja request starts first but lands last.
    await Promise.all([request('ja', 30), request('en', 10)])
    expect(results.sort()).toEqual(['Get started', '始める'].sort())
  })

  it('async continuations inside the run keep their locale', () => {
    return runWithLocale('ja', async () => {
      await new Promise((resolve) => setTimeout(resolve, 5))
      expect(t['marketing.home.cta']()).toBe('始める')
    })
  })

  it('outside a run, currentLocale falls back to the base locale', () => {
    expect(t['marketing.home.cta']()).toBe('Get started')
  })
})
