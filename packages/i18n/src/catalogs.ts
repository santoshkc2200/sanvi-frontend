import type { Locale } from './config'
import { IcuParseError, type PatternNode, parsePattern } from './icu'

/**
 * Catalog compilation — sharded by surface (TASK-032).
 *
 * The JSON shards under `messages/{en,ja}/<shard>.json` are split on the key's
 * first path segment, and each app registers only the shards its surfaces
 * render (via `src/surfaces/*.ts` — the only modules that *value*-import the
 * JSON files). The storefront therefore never carries the 130 KB `admin`
 * shard, and a budget raise is no longer the cost of every admin screen.
 *
 * `messages/en/*.json` remains the source of truth: the `MessageKey` union
 * below is computed from **type-only** imports of every en shard — no runtime
 * import, so the union is complete while each app's bundle stays partial.
 * Japanese parity is asserted the same way: `keyof typeof import('ja/*.json')`
 * unions must cover `MessageKey` exactly, so a missing or orphaned `ja` key
 * fails **typecheck** (the value-import `Record<MessageKey, string>` witness
 * this file used to carry could not survive sharding). `pnpm i18n:check`
 * remains the runtime net for malformed ICU, param drift and shard hygiene.
 *
 * `en` stays synchronous in the initial bundle (the base locale renders first
 * paint); `ja` is loaded via per-surface dynamic `import()`s so it stays out
 * of the initial `entry+chunks` budget. See `ensureLocaleLoaded`.
 *
 * A key whose shard was never registered behaves exactly like an unknown key:
 * `t` logs a console error and renders the key itself. Loud in development —
 * and the shard gate (`check:i18n-shards`) plus per-app unit tests catch it
 * in CI, because an app test that renders an unloaded shard's key fails.
 */

// Type-only shard imports — the complete key union at zero runtime cost.
// `keyof (A & B)` is `keyof A | keyof B`, so the intersection unions the keys.
type EnShards = typeof import('../messages/en/admin.json') &
  typeof import('../messages/en/auth.json') &
  typeof import('../messages/en/common.json') &
  typeof import('../messages/en/consent.json') &
  typeof import('../messages/en/errors.json') &
  typeof import('../messages/en/legal.json') &
  typeof import('../messages/en/marketing.json') &
  typeof import('../messages/en/payments.json') &
  typeof import('../messages/en/platform.json') &
  typeof import('../messages/en/privacy.json') &
  typeof import('../messages/en/settings.json') &
  typeof import('../messages/en/storefront.json') &
  typeof import('../messages/en/themeblocks.json')

type JaShards = typeof import('../messages/ja/admin.json') &
  typeof import('../messages/ja/auth.json') &
  typeof import('../messages/ja/common.json') &
  typeof import('../messages/ja/consent.json') &
  typeof import('../messages/ja/errors.json') &
  typeof import('../messages/ja/legal.json') &
  typeof import('../messages/ja/marketing.json') &
  typeof import('../messages/ja/payments.json') &
  typeof import('../messages/ja/platform.json') &
  typeof import('../messages/ja/privacy.json') &
  typeof import('../messages/ja/settings.json') &
  typeof import('../messages/ja/storefront.json') &
  typeof import('../messages/ja/themeblocks.json')

export type MessageKey = keyof EnShards & string

/** A conditional that only accepts `never` — the parity witness. */
type AssertNever<T extends never> = T
// A `ja` shard missing a key the base locale has — fails typecheck here.
type JaMissingKeys = AssertNever<Exclude<MessageKey, keyof JaShards>>
// A `ja` shard carrying a key the base locale lacks — the mirror image.
type JaOrphanedKeys = AssertNever<Exclude<keyof JaShards, MessageKey>>
// Reference both so the linter keeps them meaningful if the file is scanned.
export type JaParityWitness = [JaMissingKeys, JaOrphanedKeys]

/** A flat `{ 'area.component.key': 'pattern' }` fragment of a catalog. */
export type CatalogShard = Record<string, string>

/** Normalises a dynamically imported JSON module to its shard object. */
export function toShard(mod: unknown): CatalogShard {
  const data = (mod as { default?: CatalogShard }).default
  return (data ?? (mod as CatalogShard)) satisfies CatalogShard
}

/** What a surface registers: its synchronous en shards and its lazy ja set. */
export interface CatalogSurface {
  en: CatalogShard[]
  loadJa: () => Promise<CatalogShard[]>
}

const registeredSurfaces = new Set<string>()
const jaLoaders: Array<() => Promise<CatalogShard[]>> = []
let jaLoadPromise: Promise<void> | null = null

/**
 * The live merged catalogs. `en` is the same mutable object as
 * `messages.en`, so `import { en }` stays a truthful view as shards
 * register — apps call their surface registrar before anything renders.
 */
export const messages: Record<Locale, Record<string, string>> = {
  en: {},
} as unknown as Record<Locale, Record<string, string>>

export const en: Record<string, string> = messages.en as Record<string, string>

/** Mutable `ja` catalog — populated by `ensureLocaleLoaded('ja')`. */
export let jaCatalog: Record<MessageKey, string> = {} as Record<MessageKey, string>

let jaLoaded = false

const parsedCache = new Map<Locale, Map<string, PatternNode[] | null>>()

/**
 * Merges one locale's shards into the registry and drops any parse results
 * cached against keys that were missing a moment ago.
 */
function mergeShards(locale: Locale, shards: CatalogShard[]): void {
  const catalog = messages[locale] ?? {}
  for (const shard of shards) Object.assign(catalog, shard)
  messages[locale] = catalog
  parsedCache.delete(locale)
}

/**
 * Registers one surface's shards — idempotent by surface name. Apps call
 * their generated registrar (`@sanvi/i18n/surfaces/<app>`) exactly once at
 * boot: SvelteKit apps in both `hooks.server.ts` and the root `+layout.svelte`
 * (server and client bundles each need it), SPAs in `main.ts`.
 */
export function registerCatalogSurface(name: string, surface: CatalogSurface): void {
  if (registeredSurfaces.has(name)) return
  registeredSurfaces.add(name)
  mergeShards('en', surface.en)
  jaLoaders.push(surface.loadJa)
  // A ja load that already resolved didn't include this surface's shards.
  jaLoadPromise = null
}

export function isJaLoaded(): boolean {
  return jaLoaded
}

export async function ensureLocaleLoaded(locale: Locale): Promise<void> {
  if (locale !== 'ja' || jaLoaded) return
  if (!jaLoadPromise) {
    jaLoadPromise = Promise.all(jaLoaders.map((load) => load()))
      .then((perSurface) => {
        for (const shards of perSurface) mergeShards('ja', shards)
        jaCatalog = messages.ja as Record<MessageKey, string>
        jaLoaded = true
      })
      .catch((error: unknown) => {
        jaLoadPromise = null
        throw error
      })
  }
  await jaLoadPromise
}

/**
 * The compiled pattern for a key in a locale, or `null` when the key or its
 * syntax is bad — including a key whose shard this surface never registered.
 * Parse errors are gated at CI (`i18n:check`), so hitting one at runtime
 * means something slipped through — log once and fall back rather than
 * render nothing.
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
