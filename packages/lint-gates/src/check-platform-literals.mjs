#!/usr/bin/env node
/**
 * The matrix-is-the-only-source gate (phase 10, TASK-010, NFR-1001): fails
 * on advertising platform literals in frontend source, so a platform
 * special case cannot compile — and TASK-013's "a new network is a data
 * update, not a frontend release" proof stays honest.
 *
 * Two tiers:
 *
 *   1. `google_ads` / `meta_ads` / `asymmetric_demo` (word-bounded) may not
 *      appear in *any* shipped source — not in a comparison, not in a
 *      property access. Generated files are exempt: they are contract data,
 *      regenerated from the contract, not written by hand.
 *   2. Inside *form paths* — files under a `forms/` or `advertising/`
 *      directory, or named `*advertising*` — objective names, budget
 *      kinds, placements, and text-field/limit names may not appear as
 *      string literals either. These are matrix *values*; form code reaches
 *      them by iterating the data, never by spelling them.
 *
 * Comments are stripped before scanning — a comment explaining the
 * contract's entitlement keys is documentation; a literal in code is the
 * bug. Comment/string handling is a small hand-rolled scanner (same
 * trade-off as the other gates in this package), not a full parser.
 */
import { readFileSync } from 'node:fs'
import { extname, relative, sep } from 'node:path'
import { isMainEntryPoint, walkFiles } from './walk-files.mjs'

/** Tier 1 — platform identifiers, banned everywhere in shipped source. */
const PLATFORM_IDENTIFIERS = ['google_ads', 'meta_ads', 'asymmetric_demo']

/**
 * Tier 2 — matrix *values*. Multi-word snake_case tokens are also matched
 * as identifiers (they cannot collide with ordinary prose identifiers);
 * single generic words are only matched as whole string literals, so
 * `document.body` or an unrelated `'daily'` elsewhere never trips the gate.
 */
const MATRIX_VALUE_QUOTED = [
  'app_promotion',
  'awareness',
  'engagement',
  'leads',
  'sales',
  'traffic',
  'app_installs',
  'daily',
  'lifetime',
  'feed',
  'stories',
  'reels',
  'headline',
  'body',
  'age',
  'gender',
  'geo',
  'interests',
  'languages',
  'keywords',
  'topics',
  'devices',
  'demographics',
  'audiences',
  'custom_audiences',
  'device',
]
const MATRIX_VALUE_IDENTIFIERS = ['app_promotion', 'app_installs', 'custom_audiences']

const FORM_PATH_SEGMENT = /(^|\/)(forms|advertising)(\/|$)|advertising/i

export function isFormPath(relativePath) {
  return FORM_PATH_SEGMENT.test(relativePath)
}

/**
 * Removes comments while respecting string literals, so `//` inside a URL
 * string is not treated as a comment. Returns source without `//` and
 * `/*…*&#47;` comments (plus `<!--…-->` for `.svelte` templates).
 */
export function stripComments(source, isSvelte) {
  let out = ''
  let i = 0
  const n = source.length
  while (i < n) {
    const ch = source[i]
    const next = source[i + 1]
    if (ch === '"' || ch === "'" || ch === '`') {
      const end = findStringEnd(source, i, ch)
      out += source.slice(i, end)
      i = end
      continue
    }
    if (ch === '/' && next === '/') {
      while (i < n && source[i] !== '\n') i += 1
      continue
    }
    if (ch === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2)
      i = end === -1 ? n : end + 2
      continue
    }
    if (isSvelte && source.startsWith('<!--', i)) {
      const end = source.indexOf('-->', i + 4)
      i = end === -1 ? n : end + 3
      continue
    }
    out += ch
    i += 1
  }
  return out
}

function findStringEnd(source, start, quote) {
  let i = start + 1
  while (i < source.length) {
    if (source[i] === '\\') {
      i += 2
      continue
    }
    if (source[i] === quote) return i + 1
    if (quote !== '`' && source[i] === '\n') return i // unterminated — bail out
    i += 1
  }
  return source.length
}

function lineOf(source, index) {
  let line = 1
  for (let i = 0; i < index; i += 1) {
    if (source[i] === '\n') line += 1
  }
  return line
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * @returns {{ file: string, line: number, literal: string, tier: 1 | 2, scope: string }[]}
 */
export function scanFile(file, relativePath, source) {
  const isSvelte = extname(file) === '.svelte'
  const normalized = relativePath.split(sep).join('/')
  const code = stripComments(source, isSvelte)
  const violations = []

  // Generated files are the contract's own output — the generator may emit
  // whatever identifiers the contract carries.
  if (!normalized.includes('/generated/')) {
    for (const literal of PLATFORM_IDENTIFIERS) {
      const pattern = new RegExp(`\\b${escapeRegExp(literal)}\\b`, 'g')
      let match = pattern.exec(code)
      while (match !== null) {
        violations.push({
          file,
          line: lineOf(code, match.index),
          literal,
          tier: 1,
          scope: 'any shipped source',
        })
        match = pattern.exec(code)
      }
    }
  }

  if (isFormPath(normalized)) {
    for (const literal of MATRIX_VALUE_QUOTED) {
      const pattern = new RegExp(`['"\`]${escapeRegExp(literal)}['"\`]`, 'g')
      let match = pattern.exec(code)
      while (match !== null) {
        violations.push({
          file,
          line: lineOf(code, match.index),
          literal,
          tier: 2,
          scope: 'form path',
        })
        match = pattern.exec(code)
      }
    }
    for (const literal of MATRIX_VALUE_IDENTIFIERS) {
      const pattern = new RegExp(`\\b${escapeRegExp(literal)}\\b`, 'g')
      let match = pattern.exec(code)
      while (match !== null) {
        violations.push({
          file,
          line: lineOf(code, match.index),
          literal,
          tier: 2,
          scope: 'form path',
        })
        match = pattern.exec(code)
      }
    }
  }

  return violations
}

/** @returns {ReturnType<typeof scanFile>} */
export function scanWorkspace(root) {
  const violations = []
  const files = walkFiles(root, (name) => ['.ts', '.svelte'].includes(extname(name))).filter(
    (file) => {
      const rel = relative(root, file)
      return /^apps\/[^/]+\/(src|e2e)\//.test(rel) || /^packages\/[^/]+\/src\//.test(rel)
    },
  )
  for (const file of files) {
    const relativePath = relative(root, file)
    violations.push(...scanFile(file, relativePath, readFileSync(file, 'utf8')))
  }
  return violations
}

async function main() {
  const root = process.argv[2]
  if (!root) {
    console.error('Usage: sanvi-check-platform-literals <workspace-root>')
    process.exit(2)
  }

  const violations = scanWorkspace(root)

  if (violations.length === 0) {
    console.log('✓ check:platform-literals — the matrix is the only source')
    return
  }

  console.error(`✗ check:platform-literals — ${violations.length} violation(s):\n`)
  for (const v of violations) {
    console.error(
      `  ${v.file}:${v.line}  "${v.literal}" (tier ${v.tier}, ${v.scope})\n` +
        `    platform data belongs to the backend matrix, not to frontend source`,
    )
  }
  process.exit(1)
}

if (isMainEntryPoint(import.meta.url)) {
  await main()
}
