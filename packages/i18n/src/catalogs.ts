import enJson from '../messages/en.json'
import type { Locale } from './config'
import { IcuParseError, type PatternNode, parsePattern } from './icu'

/**
 * Catalog compilation — the only module that touches the JSON files.
 *
 * `messages/en.json` is the source of truth: its keys *are* the
 * `MessageKey` union. Every other locale is type-checked against it here —
 * a static `import jaJson` previously made a missing `ja` key a compile error,
 * and `pnpm i18n:check` catches the mirror-image (orphaned keys, malformed ICU,
 * param drift) that the type system can't see on an import.
 *
 * Hybrid budget fix: `ja` is no longer statically imported (both JSONs
 * gzipped were ~59 KB, the entire `i18n` chunk at 62 KB gz). `en` stays
 * synchronous for the initial bundle; `ja` is loaded via dynamic `import()`
 * so it becomes a separate async chunk / fetch and is excluded from the
 * initial `entry+chunks` budget. See `ensureLocaleLoaded`.
 */

export const en = enJson
export type MessageKey = keyof typeof enJson & string

/** Mutable `ja` catalog — populated by `ensureLocaleLoaded('ja')`. */
export let jaCatalog: Record<MessageKey, string> = {} as Record<MessageKey, string>

let jaLoaded = false
let jaLoadPromise: Promise<Record<MessageKey, string>> | null = null

async function loadJaCatalog(): Promise<Record<MessageKey, string>> {
  if (jaLoaded && Object.keys(jaCatalog).length > 0) return jaCatalog
  if (jaLoadPromise) return jaLoadPromise
  jaLoadPromise = import('../messages/ja.json').then((mod) => {
    const data = ((mod as unknown as { default: Record<MessageKey, string> }).default ??
      mod) as Record<MessageKey, string>
    jaCatalog = data
    ;(messages as unknown as Record<string, Record<string, string>>)['ja'] = data
    jaLoaded = true
    // Invalidate any `null` entries cached while ja was empty.
    parsedCache.delete('ja')
    return data
  })
  return jaLoadPromise
}

export function isJaLoaded(): boolean {
  return jaLoaded
}

export async function ensureLocaleLoaded(locale: Locale): Promise<void> {
  if (locale === 'ja' && !jaLoaded) {
    await loadJaCatalog()
  }
}

export const messages: Record<Locale, Record<string, string>> = {
  en,
} as unknown as Record<Locale, Record<string, string>>

const parsedCache = new Map<Locale, Map<string, PatternNode[] | null>>()

/**
 * The compiled pattern for a key in a locale, or `null` when the key or its
 * syntax is bad. Parse errors are gated at CI (`i18n:check`), so hitting
 * one at runtime means something slipped through — log once and fall back
 * rather than render nothing.
 */
export function compiledPattern(locale: Locale, key: string): PatternNode[] | null {
  let byKey = parsedCache.get(locale)
  if (!byKey) {
    byKey = new Map<string, PatternNode[] | null>()
    parsedCache.set(locale, byKey)
  }
  const cached = byKey.get(key)
  if (cached !== undefined) return cached

  const catalog = messages[locale]
  if (!catalog) {
    byKey.set(key, null)
    return null
  }
  const value = catalog[key]
  if (value === undefined) {
    byKey.set(key, null)
    return null
  }
  try {
    const nodes = parsePattern(value)
    byKey.set(key, nodes)
    return nodes
  } catch (error) {
    if (error instanceof IcuParseError) {
      console.error(`[i18n] malformed message ${locale} "${key}":`, error.message)
      byKey.set(key, null)
      return null
    }
    throw error
  }
}
