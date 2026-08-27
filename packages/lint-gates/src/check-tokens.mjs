#!/usr/bin/env node
/**
 * Flags raw color/length/font values in `<style>` blocks and inline
 * `style="..."` attributes — `docs/README.md` non-negotiable #2: only
 * `var(--sanvi-...)` from `@sanvi/design-tokens` is allowed, so phase 07 can
 * re-theme the whole product without touching component code.
 *
 * Scans `<style>` block bodies (CSS) plus inline `style="..."` attribute
 * values. Values already using `var(--sanvi-...)` are fine; everything else
 * — a hex color, an hsl()/rgb() color, or a px/rem/em length — is flagged.
 * A handful of values are never token-worthy and are allow-listed inline:
 * `0`, `1px`/`2px` (hairline borders belong to `--sanvi-border-width-*`
 * conceptually, but a bare `1px` in a non-border context like
 * `translateX(1px)` is common enough to allow), percentages, `auto`,
 * keyword values, and CSS custom property *declarations* (`--foo: ...`) of
 * a component's own scoped state (not a design value).
 *
 * `*.stories.svelte` files are excluded — Storybook example scaffolding
 * isn't shipped product UI.
 */
import { readFileSync } from 'node:fs'
import { extname } from 'node:path'
import { isMainEntryPoint, walkFiles } from './walk-files.mjs'

const IGNORE_MARKER = 'sanvi-tokens-ignore'

const HEX_COLOR = /#[0-9a-fA-F]{3,8}\b/
const COLOR_FN = /\b(rgb|rgba|hsl|hsla|oklch|oklab)\(/
const RAW_LENGTH = /(?<![\w-])-?\d*\.?\d+(px|rem|em)\b/
// `0`, `1px`, `-1px` — hairline/reset values, never a design decision.
const ALLOWED_LENGTHS = new Set(['0', '0px', '1px', '-1px'])

function hasRawLength(value) {
  const matches = value.match(new RegExp(RAW_LENGTH, 'g')) ?? []
  return matches.some((m) => !ALLOWED_LENGTHS.has(m))
}

function findStyleBlocks(source) {
  const blocks = []
  const pattern = /<style(\s[^>]*)?>([\s\S]*?)<\/style>/g
  let match = pattern.exec(source)
  while (match !== null) {
    const bodyStart = match.index + match[0].indexOf(match[2])
    blocks.push({ body: match[2], startIndex: bodyStart })
    match = pattern.exec(source)
  }
  return blocks
}

function findInlineStyleAttrs(source) {
  const blocks = []
  const pattern = /\bstyle\s*=\s*(["'])(.*?)\1/g
  let match = pattern.exec(source)
  while (match !== null) {
    const bodyStart = match.index + match[0].indexOf(match[2])
    blocks.push({ body: match[2], startIndex: bodyStart })
    match = pattern.exec(source)
  }
  return blocks
}

function lineAt(source, index) {
  let line = 1
  for (let i = 0; i < index && i < source.length; i += 1) {
    if (source[i] === '\n') line += 1
  }
  return line
}

/**
 * Splits CSS text into `property: value;` declarations (ignoring selectors/
 * at-rules/braces) and checks each value for a raw color or length. Good
 * enough for the property-value-pair shape every declaration has, without a
 * full CSS parser.
 */
function findRawValues(cssText) {
  const violations = []
  // Blank out /* ... */ comments first (same length, so offsets still line
  // up) — otherwise a colon/unit inside explanatory prose reads as a
  // declaration (e.g. "font size (12px)" inside a comment).
  const withoutComments = cssText.replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))
  const pattern = /([a-zA-Z-]+)\s*:\s*([^;{}]+);?/g
  let match = pattern.exec(withoutComments)
  while (match !== null) {
    const [full, property, rawValue] = match
    const value = rawValue.trim()

    if (property.startsWith('--')) {
      match = pattern.exec(withoutComments)
      continue // custom property declaration, not a value being set on an element
    }
    if (value.includes('var(--sanvi-')) {
      match = pattern.exec(withoutComments)
      continue
    }

    if (HEX_COLOR.test(value) || COLOR_FN.test(value) || hasRawLength(value)) {
      violations.push({
        offset: match.index + full.indexOf(value),
        snippet: `${property}: ${value}`,
      })
    }

    match = pattern.exec(withoutComments)
  }
  return violations
}

/** @returns {{ file: string, line: number, snippet: string }[]} */
export function checkFile(filePath, source) {
  const violations = []
  const regions =
    extname(filePath) === '.css'
      ? [{ body: source, startIndex: 0 }]
      : [...findStyleBlocks(source), ...findInlineStyleAttrs(source)]

  for (const region of regions) {
    for (const v of findRawValues(region.body)) {
      const absoluteIndex = region.startIndex + v.offset
      const lineStart = source.lastIndexOf('\n', absoluteIndex) + 1
      const nextNewline = source.indexOf('\n', absoluteIndex)
      const lineEnd = nextNewline === -1 ? source.length : nextNewline
      const currentLine = source.slice(lineStart, lineEnd)

      if (currentLine.includes(`/* ${IGNORE_MARKER} */`)) continue

      violations.push({ file: filePath, line: lineAt(source, absoluteIndex), snippet: v.snippet })
    }
  }

  return violations
}

export function checkDirectory(rootDir) {
  const violations = []
  for (const file of walkFiles(rootDir, (name) => {
    const ext = extname(name)
    return (ext === '.svelte' && !name.endsWith('.stories.svelte')) || ext === '.css'
  })) {
    const source = readFileSync(file, 'utf8')
    violations.push(...checkFile(file, source))
  }
  return violations
}

async function main() {
  const targets = process.argv.slice(2)
  if (targets.length === 0) {
    console.error('Usage: sanvi-check-tokens <dir> [<dir> ...]')
    process.exit(2)
  }

  const allViolations = targets.flatMap((dir) => checkDirectory(dir))

  if (allViolations.length === 0) {
    console.log('✓ check:tokens — no raw colors/lengths found')
    return
  }

  console.error(`✗ check:tokens — ${allViolations.length} raw value(s):\n`)
  for (const v of allViolations) {
    console.error(`  ${v.file}:${v.line}  ${v.snippet}`)
  }
  console.error(
    '\nUse a var(--sanvi-...) token from @sanvi/design-tokens, or suppress a false positive with a trailing /* sanvi-tokens-ignore */ comment on the same line.',
  )
  process.exit(1)
}

if (isMainEntryPoint(import.meta.url)) {
  await main()
}
