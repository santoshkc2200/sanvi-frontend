#!/usr/bin/env node
/**
 * `pnpm i18n:check` — the catalog gate (phase 06 translation workflow).
 * Runs over `packages/i18n/messages/*.json` and fails CI on:
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
 *
 * The checking logic is exported for the package's own tests; the CLI tail
 * only runs when executed directly (`isMainEntryPoint`), same pattern as
 * `packages/lint-gates`.
 */
import { readFileSync, realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const MESSAGES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'messages')

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
//    a grammar change here without there, or the reverse, is caught by the
//    package tests feeding the same fixtures to both) ──

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
    while (pos < source.length && !/[\s{]/.test(source[pos] ?? '')) pos += 1
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

// ── CLI ──

if (isMainEntryPoint(import.meta.url)) {
  const readCatalog = (locale) =>
    JSON.parse(readFileSync(join(MESSAGES_DIR, `${locale}.json`), 'utf8'))
  let manifest = {}
  try {
    manifest = JSON.parse(readFileSync(join(MESSAGES_DIR, 'manifest.json'), 'utf8'))
  } catch {
    // No manifest — no constrained slots declared.
  }
  const catalogs = { [BASE_LOCALE]: readCatalog(BASE_LOCALE) }
  for (const locale of OTHER_LOCALES) catalogs[locale] = readCatalog(locale)

  const problems = collectProblems(catalogs, manifest)
  if (problems.length > 0) {
    console.error(`i18n:check failed with ${problems.length} problem(s):\n`)
    for (const problem of problems) console.error(`  ${problem}`)
    process.exit(1)
  }
  console.log(`i18n:check ok — ${Object.keys(catalogs[BASE_LOCALE]).length} keys at 100 % coverage`)
}
