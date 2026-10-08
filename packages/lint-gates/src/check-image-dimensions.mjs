#!/usr/bin/env node
/**
 * `check:images` — every `<img>`, `<iframe>`, and `<embed>` in first-party
 * Svelte source declares explicit `width` **and** `height` attributes
 * (TASK-022, step 4). Without them the browser cannot reserve a layout box,
 * and the bytes that arrive later move everything under them — the CLS the
 * phase-11 baselines measured. Svelte's shorthand attributes (`{width}`)
 * count: they render the attribute. `<Image>` from `@sanvi/ui` enforces the
 * same contract at the type level; this gate catches everything that is not
 * (and would catch the component itself regressing).
 *
 * Suppression: a trailing `<!-- sanvi-dimensions-ignore -->` HTML comment on
 * the line before the tag, or `// sanvi-dimensions-ignore` on the same line
 * inside a `{#if}` — visible in review, per the repo's exception style.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { findWorkspaceRoot } from './perf-profiles.mjs'
import { isMainEntryPoint, walkFiles } from './walk-files.mjs'

const IGNORE_MARKER = 'sanvi-dimensions-ignore'

/** Opening tags this gate governs, with their matching regex. */
const TAG_PATTERN = /<(img|iframe|embed)\b[^>]*?>/gs

function hasDimension(tagText, dimension) {
  return (
    new RegExp(`\\s${dimension}\\s*=`, 'i').test(tagText) || new RegExp(`\\{${dimension}\\}`).test(tagText)
  )
}

/**
 * Scans one directory tree (tests point this at fixtures; the CLI walks
 * `apps/` and `packages/` with it). `walkFiles` skips `__fixtures__`, so a
 * fixture-housed violation can never leak into the real gate's verdict.
 *
 * @param {string} dir
 * @returns {{ file: string, line: number, tag: string, missing: string[] }[]} violations
 */
export function findMissingDimensionsInDir(dir) {
  const violations = []
  for (const file of walkFiles(dir, (name) => name.endsWith('.svelte'))) {
    const normalized = file.split('\\').join('/')
    if (normalized.includes('/node_modules/')) continue

    const source = readFileSync(file, 'utf8')
    const lines = source.split('\n')

    for (const match of source.matchAll(TAG_PATTERN)) {
      const tag = match[1]
      const tagText = match[0]
      const index = match.index ?? 0
      const line = source.slice(0, index).split('\n').length

      // Visible suppression: marker on the tag's own line or the line above.
      const tagLine = (lines[line - 1] ?? '').trim()
      const prevLine = (lines[line - 2] ?? '').trim()
      if (tagLine.includes(IGNORE_MARKER) || prevLine.includes(IGNORE_MARKER)) continue

      if (!hasDimension(tagText, 'width') || !hasDimension(tagText, 'height')) {
        violations.push({
          file: file.slice(dir.length + 1),
          line,
          tag,
          missing: ['width', 'height'].filter((d) => !hasDimension(tagText, d)),
        })
      }
    }
  }
  return violations
}

/**
 * @param {string} root workspace root
 * @returns {{ file: string, line: number, tag: string }[]} violations
 */
export function findMissingDimensions(root) {
  return [
    ...findMissingDimensionsInDir(join(root, 'apps')),
    ...findMissingDimensionsInDir(join(root, 'packages')),
  ]
}

function main() {
  const root = findWorkspaceRoot()
  const violations = findMissingDimensions(root)
  if (violations.length === 0) {
    console.log('✓ every <img>/<iframe>/<embed> declares explicit width and height')
    return
  }
  console.error(
    `✗ ${violations.length} element(s) without explicit dimensions (CLS — the browser cannot reserve their box):`,
  )
  for (const v of violations) {
    console.error(`    ${v.file}:${v.line}  <${v.tag}> missing ${v.missing.join(', ')}`)
  }
  process.exit(1)
}

if (isMainEntryPoint(import.meta.url)) {
  main()
}
