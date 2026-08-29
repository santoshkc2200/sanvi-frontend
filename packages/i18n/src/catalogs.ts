import enJson from '../messages/en.json'
import jaJson from '../messages/ja.json'
import type { Locale } from './config'
import { IcuParseError, type PatternNode, parsePattern } from './icu'

/**
 * Catalog compilation — the only module that touches the JSON files.
 *
 * `messages/en.json` is the source of truth: its keys *are* the
 * `MessageKey` union. Every other locale is type-checked against it here —
 * `jaCatalog`'s annotation makes a missing `ja` key a compile error (the
 * phase-06 plan's "missing keys are compile errors"), and `pnpm i18n:check`
 * catches the mirror-image (orphaned keys, malformed ICU, param drift) that
 * the type system can't see on an import.
 */

export const en = enJson
export type MessageKey = keyof typeof enJson & string

/** Compile-time parity assertion: every English key must have a Japanese value. */
export const jaCatalog: Record<MessageKey, string> = jaJson

export const messages: Record<Locale, Record<string, string>> = {
  en,
  ja: jaCatalog,
}

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

  const value = messages[locale][key]
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
