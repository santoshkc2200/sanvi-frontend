#!/usr/bin/env node
/**
 * `check:i18n-shards` — TASK-032's build-output gate: **no app's build
 * output contains a key from a surface it does not render.**
 *
 * The catalog shards under `packages/i18n/messages/{en,ja}/<shard>.json`
 * are split by surface, and each app registers only its own set (via
 * `@sanvi/i18n/surfaces/<app>`). This gate asserts the split actually
 * holds in what ships, not just in the source:
 *
 * - **foreign markers** — for every shard *outside* the app's surface, a
 *   sample of that shard's longest locale-safe string values must appear
 *   nowhere in the app's client JS. A leaked shard arrives whole (a JSON
 *   import bundles the entire object), so a sample of distinctive
 *   sentences detects any leak.
 * - **own markers** — for every shard *in* the app's surface, at least one
 *   of its longest values must be present. This keeps the gate from
 *   passing vacuously: if a surface registrar is tree-shaken away or
 *   silently loads nothing, the app has no strings at all and the gate
 *   fails rather than celebrate the absence of foreign ones.
 *
 * Values are searched as raw substrings of the built `.js` files. Markers
 * containing `"` or `\` are skipped because those characters are escaped
 * in the emitted JS string literals and would never match literally.
 *
 * The surface→shard map is parsed out of `packages/i18n/src/surfaces/*.ts`
 * (the same regexes `packages/i18n/tools/check.mjs` uses — one canonical
 * definition, two readers, kept honest by that package's own tests).
 *
 * Needs `pnpm build` first, exactly like `check:budget`; apps without a
 * build are skipped with a message rather than failed.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { findWorkspaceRoot } from './perf-profiles.mjs'
import { isDirectory, isMainEntryPoint, walkFiles } from './walk-files.mjs'

/** app name → surface file name (`src/surfaces/<name>.ts`); mirrors budgets.json's app names. */
const APP_SURFACES = {
  storefront: 'storefront',
  marketing: 'marketing',
  admin: 'admin',
  'platform-admin': 'platform-admin',
}

const EN_SHARD_IMPORT = /from\s+'[^']*?messages\/en\/([a-z0-9-]+)\.json'/g
const JA_SHARD_IMPORT = /import\(\s*'[^']*?messages\/ja\/([a-z0-9-]+)\.json'\s*\)/g

/** Mirrors `packages/i18n/tools/check.mjs`'s parser — see that file's header. */
export function parseSurfaceFile(source) {
  const en = new Set()
  const ja = new Set()
  let match = EN_SHARD_IMPORT.exec(source)
  while (match !== null) {
    en.add(match[1])
    match = EN_SHARD_IMPORT.exec(source)
  }
  match = JA_SHARD_IMPORT.exec(source)
  while (match !== null) {
    ja.add(match[1])
    match = JA_SHARD_IMPORT.exec(source)
  }
  return { en, ja }
}

/**
 * Marker candidates for one shard: its values, longest first, keeping only
 * strings that (a) survive as literal substrings of emitted JS (no quote or
 * backslash — both get escaped), (b) are long enough to be distinctive, and
 * (c) belong to this shard alone. (c) matters because ~200 short chrome
 * strings ("Loading", "Members", "Already have an account?") are shared
 * verbatim between shards — such a value proves nothing about *which*
 * shard shipped, so it is not a marker.
 *
 * `shared` is the set of a locale's values that occur in more than one
 * shard (see {@link sharedValues}).
 */
export function shardMarkers(shard, { foreign, shared = new Set() }) {
  const min = foreign ? 24 : 8
  const take = foreign ? 25 : 5
  return [...new Set(Object.values(shard).filter((v) => typeof v === 'string'))]
    .filter((v) => v.length >= min && !/["\\]/.test(v) && !shared.has(v))
    .sort((a, b) => b.length - a.length)
    .slice(0, take)
}

/**
 * Values occurring in more than one shard, per locale — the strings that
 * cannot serve as leak markers.
 *
 * @param {Map<string, Record<string, Record<string, string>>>} shardValues
 * @returns {Record<string, Set<string>>}
 */
export function sharedValues(shardValues) {
  const byLocale = {}
  for (const [shard, locales] of shardValues) {
    for (const [locale, values] of Object.entries(locales)) {
      let owners = byLocale[locale]
      if (!owners) {
        owners = new Map()
        byLocale[locale] = owners
      }
      for (const value of Object.values(values)) {
        const shards = owners.get(value) ?? new Set()
        shards.add(shard)
        owners.set(value, shards)
      }
    }
  }
  const shared = {}
  for (const [locale, owners] of Object.entries(byLocale)) {
    shared[locale] = new Set(
      [...owners.entries()].filter(([, shards]) => shards.size > 1).map(([value]) => value),
    )
  }
  return shared
}

/**
 * The leak scan over one app's built client JS.
 *
 * @param {{ files: { path: string, content: string }[], surfaceShards: Set<string>, shardValues: Map<string, Record<string, Record<string, string>>> }} input
 * @returns {{ ok: boolean, foreignHits: { shard: string, locale: string, file: string, marker: string }[], missingOwn: string[], checkedFiles: number }}
 */
export function scanSurfaceLeaks({ files, surfaceShards, shardValues }) {
  const haystacks = files.map((f) => ({ path: f.path, content: f.content }))
  const find = (marker) => haystacks.find((f) => f.content.includes(marker))
  const shared = sharedValues(shardValues)

  const foreignHits = []
  const missingOwn = []
  for (const [shard, byLocale] of shardValues) {
    const own = surfaceShards.has(shard)
    for (const [locale, values] of Object.entries(byLocale)) {
      const markers = shardMarkers(values, { foreign: !own, shared: shared[locale] })
      if (own) {
        if (markers.length > 0 && !markers.some((m) => find(m) !== undefined)) {
          missingOwn.push(`${shard} (${locale})`)
        }
      } else {
        for (const marker of markers) {
          const hit = find(marker)
          if (hit) foreignHits.push({ shard, locale, file: hit.path, marker })
        }
      }
    }
  }
  return {
    ok: foreignHits.length === 0 && missingOwn.length === 0,
    foreignHits,
    missingOwn,
    checkedFiles: files.length,
  }
}

/** Reads every `.js` file under one directory into memory for the scan. */
function readJsFiles(dir) {
  return [...walkFiles(dir, (name) => name.endsWith('.js'))].map((path) => ({
    path,
    content: readFileSync(path, 'utf8'),
  }))
}

/**
 * Whole-workspace run: parses the surfaces, loads every shard's values for
 * both locales, and scans each app's client build.
 *
 * @param {{ root?: string }} options
 * @returns {{ ok: boolean, results: Array<{ name: string, skipped?: boolean, message?: string } & ReturnType<typeof scanSurfaceLeaks> }> }}
 */
export function runShardGate({ root = findWorkspaceRoot() } = {}) {
  const i18nDir = join(root, 'packages', 'i18n')
  const surfacesDir = join(i18nDir, 'src', 'surfaces')

  const surfaces = {}
  for (const name of readdirSync(surfacesDir).filter((f) => f.endsWith('.ts'))) {
    surfaces[name.replace(/\.ts$/, '')] = parseSurfaceFile(
      readFileSync(join(surfacesDir, name), 'utf8'),
    )
  }

  // shard → { en: values, ja: values } across every locale directory.
  const shardValues = new Map()
  for (const locale of ['en', 'ja']) {
    const dir = join(i18nDir, 'messages', locale)
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const shard = file.replace(/\.json$/, '')
      const entry = shardValues.get(shard) ?? {}
      entry[locale] = JSON.parse(readFileSync(join(dir, file), 'utf8'))
      shardValues.set(shard, entry)
    }
  }

  const results = []
  for (const [app, surface] of Object.entries(APP_SURFACES)) {
    const buildDir = join(
      root,
      'apps',
      app,
      app === 'storefront' || app === 'marketing' ? join('build', 'client') : 'dist',
    )
    if (!isDirectory(buildDir)) {
      results.push({
        name: app,
        ok: true,
        skipped: true,
        message: `(skipped — ${buildDir} does not exist; run \`build\` first)`,
        foreignHits: [],
        missingOwn: [],
        checkedFiles: 0,
      })
      continue
    }
    const parsed = surfaces[surface]
    if (!parsed) {
      results.push({
        name: app,
        ok: false,
        skipped: false,
        message: `no src/surfaces/${surface}.ts found in @sanvi/i18n`,
        foreignHits: [],
        missingOwn: [],
        checkedFiles: 0,
      })
      continue
    }
    const result = scanSurfaceLeaks({
      files: readJsFiles(buildDir),
      surfaceShards: parsed.en,
      shardValues,
    })
    results.push({ name: app, ...result })
  }
  return { ok: results.every((r) => r.ok), results }
}

export function formatShardReport(result) {
  if (result.skipped) return `==> ${result.name}: ${result.message}`
  const lines = [`==> ${result.name} (${result.checkedFiles} JS files scanned)`]
  if (result.foreignHits.length === 0 && result.missingOwn.length === 0) {
    lines.push('  ✓ no foreign-surface catalog strings in the build output')
    return lines.join('\n')
  }
  for (const hit of result.foreignHits) {
    lines.push(
      `  ✗ ${hit.shard} shard (${hit.locale}) leaked into ${hit.file}: "${hit.marker.slice(0, 60)}${hit.marker.length > 60 ? '…' : ''}"`,
    )
  }
  for (const shard of result.missingOwn) {
    lines.push(
      `  ✗ own shard ${shard} not found in the build — surface registrar tree-shaken or unloaded?`,
    )
  }
  return lines.join('\n')
}

async function main() {
  const { ok, results } = runShardGate()
  for (const result of results) console.log(formatShardReport(result))
  if (!ok) {
    console.error(
      '\ncheck:i18n-shards failed — an app is shipping catalog shards for surfaces it does not render.',
    )
    process.exit(1)
  }
}

if (isMainEntryPoint(import.meta.url)) await main()
