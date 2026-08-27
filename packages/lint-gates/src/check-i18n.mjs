#!/usr/bin/env node
/**
 * Flags hardcoded user-facing string literals in `.svelte` templates —
 * `docs/README.md` non-negotiable #1: every string goes through a `labels`/
 * prop (today) or `@sanvi/i18n` (phase 06) so translation is never a
 * markup refactor.
 *
 * This is a small hand-written tokenizer, not a full parser: a single pass
 * over the source tracking whether we're inside a tag (`<...>`, quote-aware
 * so a `>` in an attribute value doesn't end it early), a mustache
 * expression (`{...}`, brace-depth-aware), an HTML comment, or a
 * `<script>`/`<style>` block — text is only checked outside all of those.
 * It also flags string-literal values (not `{expression}`) on a small set
 * of user-facing attributes.
 *
 * `*.stories.svelte` files are excluded — Storybook example copy is dev
 * documentation, not shipped UI.
 *
 * False positives are handled with an inline `<!-- sanvi-i18n-ignore -->`
 * HTML comment placed immediately before the specific text run or tag it
 * suppresses (not necessarily before the enclosing element — a comment
 * before an opening tag suppresses that tag's attributes, not the text
 * inside it) — not a config allow-list, so every exception is visible in
 * review.
 */
import { readFileSync } from 'node:fs'
import { extname } from 'node:path'
import { isMainEntryPoint, walkFiles } from './walk-files.mjs'

const USER_FACING_ATTRS = [
  'aria-label',
  'aria-description',
  'aria-roledescription',
  'alt',
  'placeholder',
  'title',
]
const IGNORE_MARKER = 'sanvi-i18n-ignore'

function hasLetters(text) {
  // Strip named HTML entities (&times; &nbsp; &amp; ...) — symbols, not text.
  const withoutEntities = text.replace(/&[a-zA-Z]+;/g, ' ')
  return /[A-Za-z]{2,}/.test(withoutEntities)
}

function countNewlines(text) {
  let count = 0
  for (const ch of text) if (ch === '\n') count += 1
  return count
}

function findAttributeViolations(tagSource) {
  const violations = []
  const pattern = new RegExp(
    `\\b(${USER_FACING_ATTRS.join('|')})\\s*=\\s*(["'])([^"'{][^"']*)\\2`,
    'g',
  )
  let match = pattern.exec(tagSource)
  while (match !== null) {
    violations.push(`${match[1]}="${match[3]}"`)
    match = pattern.exec(tagSource)
  }
  return violations
}

/** @returns {{ file: string, line: number, snippet: string }[]} */
export function checkFile(filePath, source) {
  const violations = []
  let i = 0
  let line = 1
  let pendingIgnore = false

  function advance(to) {
    line += countNewlines(source.slice(i, to))
    i = to
  }

  while (i < source.length) {
    const ch = source[i]

    // HTML comment — consume whole, check for the ignore marker.
    if (source.startsWith('<!--', i)) {
      const start = i
      const end = source.indexOf('-->', i + 4)
      const commentEnd = end === -1 ? source.length : end + 3
      const commentBody = source.slice(start + 4, end === -1 ? source.length : end)
      if (commentBody.trim() === IGNORE_MARKER) pendingIgnore = true
      advance(commentEnd)
      continue
    }

    // <script> / <style> — skip the whole block body.
    const blockMatch = /^<(script|style)(\s[^>]*)?>/.exec(source.slice(i))
    if (blockMatch) {
      const tag = blockMatch[1]
      const closeTag = `</${tag}>`
      const closeIndex = source.indexOf(closeTag, i + blockMatch[0].length)
      advance(closeIndex === -1 ? source.length : closeIndex + closeTag.length)
      pendingIgnore = false
      continue
    }

    // A tag (open, close, or self-closing) — quote-aware so an attribute
    // value can safely contain '>' or '<'.
    if (ch === '<') {
      const tagStart = i
      const tagStartLine = line
      let j = i + 1
      let quote = null
      let braceDepth = 0
      while (j < source.length) {
        const c = source[j]
        if (quote) {
          if (c === quote) quote = null
        } else if (braceDepth > 0) {
          // Inside a `{...}` attribute expression (e.g. on:click={() => ...}):
          // its own quotes/`>` (from `=>`) don't affect tag-quote state.
          if (c === '{') braceDepth += 1
          else if (c === '}') braceDepth -= 1
        } else if (c === '"' || c === "'") {
          quote = c
        } else if (c === '{') {
          braceDepth += 1
        } else if (c === '>') {
          j += 1
          break
        }
        j += 1
      }
      const tagSource = source.slice(tagStart, j)

      if (!pendingIgnore) {
        for (const snippet of findAttributeViolations(tagSource)) {
          violations.push({ file: filePath, line: tagStartLine, snippet })
        }
      }
      pendingIgnore = false
      advance(j)
      continue
    }

    // A mustache expression — brace-depth-aware, not scanned for content
    // (JS expressions are out of this gate's scope; see module docstring).
    // An ignore marker is spent on the next tag or text run, never carried
    // through an expression to suppress something further along.
    if (ch === '{') {
      let depth = 1
      let j = i + 1
      while (j < source.length && depth > 0) {
        if (source[j] === '{') depth += 1
        else if (source[j] === '}') depth -= 1
        j += 1
      }
      advance(j)
      pendingIgnore = false
      continue
    }

    // Plain text — accumulate the run up to the next '<' or '{'.
    const textStart = i
    const textStartLine = line
    let j = i
    while (j < source.length && source[j] !== '<' && source[j] !== '{') j += 1
    const text = source.slice(textStart, j)
    advance(j)

    if (!pendingIgnore && hasLetters(text)) {
      violations.push({ file: filePath, line: textStartLine, snippet: text.trim().slice(0, 80) })
    }
    pendingIgnore = false
  }

  return violations
}

export function checkDirectory(rootDir) {
  const violations = []
  for (const file of walkFiles(
    rootDir,
    (name) => extname(name) === '.svelte' && !name.endsWith('.stories.svelte'),
  )) {
    const source = readFileSync(file, 'utf8')
    violations.push(...checkFile(file, source))
  }
  return violations
}

async function main() {
  const targets = process.argv.slice(2)
  if (targets.length === 0) {
    console.error('Usage: sanvi-check-i18n <dir> [<dir> ...]')
    process.exit(2)
  }

  const allViolations = targets.flatMap((dir) => checkDirectory(dir))

  if (allViolations.length === 0) {
    console.log('✓ check:i18n — no hardcoded strings found')
    return
  }

  console.error(`✗ check:i18n — ${allViolations.length} possible hardcoded string(s):\n`)
  for (const v of allViolations) {
    console.error(`  ${v.file}:${v.line}  ${v.snippet}`)
  }
  console.error(
    '\nRoute the string through a `labels`/prop or `@sanvi/i18n` call, or suppress a false positive with <!-- sanvi-i18n-ignore --> immediately before it.',
  )
  process.exit(1)
}

if (isMainEntryPoint(import.meta.url)) {
  await main()
}
