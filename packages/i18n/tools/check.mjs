#!/usr/bin/env node
/**
 * `pnpm i18n:check` — the catalog gate (phase 06 translation workflow,
 * shard-aware since TASK-032). Runs over `packages/i18n/messages/{en,ja}/
 * *.json` and fails CI on:
 *
 * - **missing keys** — any locale missing a key the base locale (`en`) has
 *   (shipped surfaces must be 100 % covered in `en`/`ja`)
 * - **orphaned keys** — a locale carrying a key the base locale doesn't
 *   (the type system already blocks this; the gate is the runtime net)
 * - **malformed ICU** — every value is parsed with the same grammar the
 *   runtime uses (mirrored here so the gate has zero build step)
 * - **param drift** — locales must consume exactly the same params as the
 *   base locale (`#`-bound plural args count as the plural param)
 * - **over-length** — `messages/manifest.json` may declare
 *   `{ "key": { "maxLength": 30 } }` for slots with known space budgets
 *   (button labels, badges); every locale's value is checked against it
 * - **shard hygiene** (TASK-032) — shards are split on the key's first path
 *   segment, so: both locales carry the same shard set, every key lives in
 *   the shard its prefix names, every shard is registered by at least one
 *   surface, each surface's `en` and `ja` loaders import the same shard set,
 *   and the `all` surface (the tests-only completeness witness) covers every
 *   shard
 *
 * The checking logic is exported for the package's own tests; the CLI tail
 * only runs when executed directly (`isMainEntryPoint`), same pattern as
 * `packages/lint-gates`.
 */
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MESSAGES_DIR = join(PACKAGE_ROOT, 'messages')
const SURFACES_DIR = join(PACKAGE_ROOT, 'src', 'surfaces')

/**
 * True when this module is the process entry point. Realpath comparison, not
 * string equality — pnpm bin shims exec a symlink under `node_modules/.bin`,
 * so `import.meta.url` never string-equals `process.argv[1]` (the same trap
 * `@sanvi/lint-gates` documents in `walk-files.mjs`).
 */
function isMainEntryPoint(metaUrl) {
  const entry = process.argv[1]
  if (!entry) return false
  try {
    return realpathSync(entry) === fileURLToPath(metaUrl)
  } catch {
    return false
  }
}
export const BASE_LOCALE = 'en'
export const OTHER_LOCALES = ['ja']

class Skip extends Error {}

// ── ICU validation (mirrors src/icu.ts's grammar; keep the two in sync —
//    a grammar change here without there, or the reverse, is caught by
//    the package tests feeding the same fixtures to both) ──

/**
 * Validates one pattern; pushes `locale  key  problem` lines into `errors`
 * and returns the set of param names the pattern consumes.
 */
export function validatePattern(source, locale, key, errors) {
  const params = new Set()
  let pos = 0
  const pluralStack = []

  function fail(message) {
    errors.push(`${locale}  ${key}  malformed ICU: ${message} (at ${pos})`)
    throw new Skip()
  }

  function parseNodes(nested) {
    while (pos < source.length) {
      const ch = source[pos]
      if (ch === '}') {
        if (!nested) fail('unexpected "}"')
        return
      }
      if (ch === '{') {
        parseArgument()
      } else if (ch === '#' && pluralStack.length > 0) {
        params.add(pluralStack[pluralStack.length - 1])
        pos += 1
      } else {
        pos += 1
      }
    }
    if (nested) fail('missing "}"')
  }

  function parseArgument() {
    pos += 1
    const name = readUntil(',', '}')
    if (source[pos] === '}') {
      pos += 1
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) fail(`invalid argument name "${name}"`)
      params.add(name)
      return
    }
    pos += 1
    const type = readUntil(',', '}').trim()
    if (source[pos] !== ',') fail('expected "," after argument type')
    pos += 1
    if (type !== 'plural' && type !== 'select') {
      fail(`unsupported type "${type}" (only plural and select)`)
    }
    if (type === 'plural') {
      const m = /^\s*offset\s*:\s*(\d+)/.exec(source.slice(pos))
      if (m) pos += m[0].length
    }
    let sawOther = false
    for (;;) {
      skipWhitespace()
      if (pos >= source.length || source[pos] === '}') break
      const selector = readSelector()
      if (type === 'plural') {
        if (!selector.startsWith('=') && !/^(zero|one|two|few|many|other)$/.test(selector)) {
          fail(`invalid plural selector "${selector}"`)
        }
      } else if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(selector)) {
        fail(`invalid select selector "${selector}"`)
      }
      if (selector === 'other') sawOther = true
      skipWhitespace()
      if (source[pos] !== '{') fail(`expected "{" after selector "${selector}"`)
      pos += 1
      if (type === 'plural') pluralStack.push(name)
      try {
        parseNodes(true)
      } finally {
        if (type === 'plural') pluralStack.pop()
      }
      pos += 1
    }
    if (source[pos] !== '}') fail('expected "}" to close the argument')
    pos += 1
    if (!sawOther) fail(`"${type}" for "${name}" is missing "other"`)
    params.add(name)
  }

  function readUntil(...stopChars) {
    const start = pos
    while (pos < source.length && !stopChars.includes(source[pos])) pos += 1
    if (pos >= source.length) fail('unexpected end of pattern')
    return source.slice(start, pos).trim()
  }

  function readSelector() {
    const start = pos
    while (!/[\s{]/.test(source[pos] ?? '')) pos += 1
    if (pos === start) fail('expected a selector')
    return source.slice(start, pos)
  }

  function skipWhitespace() {
    while (/[\s]/.test(source[pos] ?? '')) pos += 1
    return pos < source.length
  }

  try {
    parseNodes(false)
  } catch (error) {
    if (!(error instanceof Skip)) throw error
  }
  return params
}

/** Param extraction that never throws — validity errors are the other pass's job. */
function safeParams(source) {
  try {
    return validatePattern(source, '-', '-', [])
  } catch (error) {
    if (error instanceof Skip) return new Set()
    throw error
  }
}

/**
 * The gate over in-memory catalogs: `catalogs` maps locale → flat key/value
 * object, `manifest` maps key → `{ maxLength }`. Returns problem lines;
 * empty means clean.
 */
export function collectProblems(catalogs, manifest = {}) {
  const problems = []
  const base = catalogs[BASE_LOCALE]
  if (!base) return [`${BASE_LOCALE}  —  base catalog is missing`]

  for (const [key, value] of Object.entries(base)) {
    if (typeof value !== 'string' || value.trim() === '') {
      problems.push(`${BASE_LOCALE}  ${key}  value must be a non-empty string`)
      continue
    }
    if (!/^[a-z0-9]+(\.[A-Za-z0-9_-]+)+$/.test(key)) {
      problems.push(`${BASE_LOCALE}  ${key}  key must be dot-namespaced (area.component.element)`)
      continue
    }
    validatePattern(value, BASE_LOCALE, key, problems)
    const limit = manifest[key]?.maxLength
    if (limit && value.length > limit) {
      problems.push(`${BASE_LOCALE}  ${key}  exceeds maxLength ${limit} (${value.length})`)
    }
  }

  for (const locale of OTHER_LOCALES) {
    const catalog = catalogs[locale]
    if (!catalog) {
      problems.push(`${locale}  —  catalog is missing`)
      continue
    }
    for (const [key, baseValue] of Object.entries(base)) {
      const value = catalog[key]
      if (value === undefined) {
        problems.push(`${locale}  ${key}  missing key`)
        continue
      }
      if (typeof value !== 'string' || value.trim() === '') {
        problems.push(`${locale}  ${key}  value must be a non-empty string`)
        continue
      }
      const baseParams = safeParams(baseValue)
      const localeParams = safeParams(value)
      for (const p of baseParams) {
        if (!localeParams.has(p)) problems.push(`${locale}  ${key}  does not use base param "${p}"`)
      }
      for (const p of localeParams) {
        if (!baseParams.has(p)) problems.push(`${locale}  ${key}  uses unknown param "${p}"`)
      }
      const limit = manifest[key]?.maxLength
      if (limit && value.length > limit) {
        problems.push(`${locale}  ${key}  exceeds maxLength ${limit} (${value.length})`)
      }
    }
    for (const key of Object.keys(catalog)) {
      if (!(key in base)) problems.push(`${locale}  ${key}  orphaned key (not in ${BASE_LOCALE})`)
    }
  }
  return problems
}

// ── Shard reading and hygiene (TASK-032) ──

/** Reads `messages/<locale>/*.json` into `{ shards: Map<name, catalog>, merged }`. */
export function readShardCatalogs(locale, messagesDir = MESSAGES_DIR) {
  const dir = join(messagesDir, locale)
  const shards = new Map()
  const merged = {}
  if (!existsSync(dir)) return { shards, merged }
  for (const name of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const catalog = JSON.parse(readFileSync(join(dir, name), 'utf8'))
    shards.set(name.replace(/\.json$/, ''), catalog)
    Object.assign(merged, catalog)
  }
  return { shards, merged }
}

/**
 * Shard coherence within one locale and across the locale set: both locales
 * carry the same shard files, and every key lives in the shard its first
 * path segment names (the invariant `check:i18n-shards` and the surface
 * modules both lean on).
 */
export function collectShardProblems(shardSetsByLocale) {
  const problems = []
  const baseSet = shardSetsByLocale[BASE_LOCALE]
  if (!baseSet || baseSet.size === 0) {
    problems.push(`${BASE_LOCALE}  —  no shard files found under messages/${BASE_LOCALE}/`)
    return problems
  }
  for (const locale of OTHER_LOCALES) {
    const set = shardSetsByLocale[locale]
    if (!set) {
      problems.push(`${locale}  —  no shard files found under messages/${locale}/`)
      continue
    }
    for (const shard of baseSet.keys()) {
      if (!set.has(shard)) problems.push(`${locale}  —  shard missing: ${shard}.json`)
    }
    for (const shard of set.keys()) {
      if (!baseSet.has(shard)) problems.push(`${locale}  —  shard not in ${BASE_LOCALE}: ${shard}.json`)
    }
  }
  // Key placement — checked per locale against the shard each key sits in.
  for (const [locale, shards] of Object.entries(shardSetsByLocale)) {
    for (const [shard, catalog] of shards) {
      for (const key of Object.keys(catalog)) {
        const prefix = key.split('.')[0]
        if (prefix !== shard) {
          problems.push(`${locale}  ${key}  lives in shard "${shard}" but its prefix names "${prefix}"`)
        }
      }
    }
  }
  return problems
}

const EN_SHARD_IMPORT = /from\s+'[^']*?messages\/en\/([a-z0-9-]+)\.json'/g
const JA_SHARD_IMPORT = /import\(\s*'[^']*?messages\/ja\/([a-z0-9-]+)\.json'\s*\)/g

/** Parses one `src/surfaces/*.ts` file into `{ en, ja }` shard-name sets. */
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
 * Surface coherence: every surface loads the same shard set for `en` and
 * `ja`; the `all` surface covers every shard (the completeness witness);
 * every shard is reachable through at least one non-`all` surface — an
 * orphaned shard's keys could never render anywhere.
 */
export function collectSurfaceProblems(surfaces, allShards) {
  const problems = []
  for (const [name, { en, ja }] of Object.entries(surfaces)) {
    for (const shard of en) {
      if (!ja.has(shard)) problems.push(`surface ${name}  loads en/${shard}.json but not ja/${shard}.json`)
    }
    for (const shard of ja) {
      if (!en.has(shard)) problems.push(`surface ${name}  loads ja/${shard}.json but not en/${shard}.json`)
    }
  }
  const allSurface = surfaces['all']
  if (!allSurface) {
    problems.push('surfaces  —  src/surfaces/all.ts is missing (the tests-only completeness witness)')
  } else {
    for (const shard of allShards) {
      if (!allSurface.en.has(shard)) {
        problems.push(`surface all  —  does not cover shard ${shard}.json`)
      }
    }
  }
  const reachable = new Set()
  for (const [name, { en }] of Object.entries(surfaces)) {
    if (name === 'all') continue
    for (const shard of en) reachable.add(shard)
  }
  for (const shard of allShards) {
    if (!reachable.has(shard)) {
      problems.push(`surfaces  —  shard ${shard}.json is registered by no app surface (keys unreachable)`)
    }
  }
  return problems
}

// ── CLI ──

if (isMainEntryPoint(import.meta.url)) {
  const readShardsFor = (locale) => readShardCatalogs(locale)
  const enBundle = readShardsFor(BASE_LOCALE)
  const catalogs = { [BASE_LOCALE]: enBundle.merged }
  const shardSetsByLocale = { [BASE_LOCALE]: enBundle.shards }
  for (const locale of OTHER_LOCALES) {
    const bundle = readShardsFor(locale)
    catalogs[locale] = bundle.merged
    shardSetsByLocale[locale] = bundle.shards
  }

  let manifest = {}
  try {
    manifest = JSON.parse(readFileSync(join(MESSAGES_DIR, 'manifest.json'), 'utf8'))
  } catch {
    // No manifest — no constrained slots declared.
  }

  const problems = [
    ...collectProblems(catalogs, manifest),
    ...collectShardProblems(shardSetsByLocale),
  ]

  const surfaces = {}
  if (existsSync(SURFACES_DIR)) {
    for (const name of readdirSync(SURFACES_DIR).filter((f) => f.endsWith('.ts'))) {
      surfaces[name.replace(/\.ts$/, '')] = parseSurfaceFile(
        readFileSync(join(SURFACES_DIR, name), 'utf8'),
      )
    }
  }
  problems.push(...collectSurfaceProblems(surfaces, enBundle.shards.keys()))

  if (problems.length > 0) {
    console.error(`i18n:check failed with ${problems.length} problem(s):\n`)
    for (const problem of problems) console.error(`  ${problem}`)
    process.exit(1)
  }
  const shardCount = enBundle.shards.size
  console.log(
    `i18n:check ok — ${Object.keys(catalogs[BASE_LOCALE]).length} keys across ${shardCount} shards at 100 % coverage`,
  )
}
