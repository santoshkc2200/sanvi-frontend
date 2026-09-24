#!/usr/bin/env node
/**
 * The runtime-code-source gate (phase 11, TASK-024): no package may fetch
 * or execute *code* at runtime from an origin the CSP does not govern —
 * `importScripts`, worker construction from a URL, script-tag injection,
 * `new Function`/`eval`, or a dynamic `import()` of an URL. The CSP blocks
 * most of these at runtime; this gate catches them at review time, when the
 * offending dependency or pattern is still cheap to remove.
 *
 * Fails on any match in shipped source outside the reviewed allow-list.
 * `new Worker(new URL('./x.ts', import.meta.url), { type: 'module' })` from
 * the app's own origin is the expected legitimate shape and is what the
 * allow-list exists for; a bundler-inlined blob worker needs an entry too.
 */
import { readFileSync } from 'node:fs'
import { extname, relative } from 'node:path'
import { isMainEntryPoint, walkFiles } from './walk-files.mjs'
import { stripComments } from './check-platform-literals.mjs'

/**
 * Patterns that load or execute code dynamically. All are CSP-adjacent:
 * `script-src`/`worker-src`/`connect-src` would have the final say at
 * runtime — this gate is the review-time twin.
 */
const CODE_LOADING_PATTERNS = [
  /\bimportScripts\s*\(/,
  /\bnew\s+Worker\s*\(/,
  /\bnew\s+SharedWorker\s*\(/,
  /\bnew\s+ServiceWorker\s*\(/,
  /\bnavigator\.serviceWorker\.register\s*\(/,
  /createElement\s*\(\s*['"]script['"]\s*\)/,
  /\bnew\s+Function\s*\(/,
  /\beval\s*\(/,
  /\bimport\s*\(\s*['"]https?:/,
]

/** Reviewed exceptions, as `${relativePath}` entries naming the origin story.
 * A new entry is a change to this file, visible in review. */
const ALLOWED = new Set([
  // `@sanvi/consent`'s gated script loader — the *designed* third-party
  // script path (phase 05): a script may only load when every one of its
  // processing purposes is allowed by the directive resolver, from an URL on
  // the caller-supplied allow-list, re-verified when the script lands. This
  // loader is itself the gate every other script must pass through.
  'packages/consent/src/loader.ts',
])

const extensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.svelte'])

function isTestPath(relativePath) {
  const normalized = relativePath.split('\\').join('/')
  return (
    /(^|\/)(__tests__|tests|e2e)(\/|$)/.test(normalized) ||
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(normalized) ||
    /\.stories\.svelte$/.test(normalized)
  )
}

export function scanWorkspace(root) {
  const violations = []
  for (const file of walkFiles(root, (name) => extensions.has(extname(name)))) {
    const relativePath = relative(root, file).split('\\').join('/')
    if (isTestPath(relativePath)) continue
    if (relativePath.endsWith('check-runtime-code-sources.mjs')) continue
    if (relativePath.split('/').some((segment) => segment.startsWith('.'))) continue

    const source = readFileSync(file, 'utf8')
    const stripped = stripComments(source, extname(file) === '.svelte')
    const lines = stripped.split('\n')
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i]
      if (!line) continue
      const hit = CODE_LOADING_PATTERNS.find((pattern) => pattern.test(line))
      if (!hit) continue
      if (ALLOWED.has(relativePath)) continue
      violations.push({ file: relativePath, line: i + 1 })
    }
  }
  return violations
}

async function main() {
  const root = process.argv[2]
  if (!root) {
    console.error('Usage: sanvi-check-runtime-code-sources <workspace-root>')
    process.exit(2)
  }

  const violations = scanWorkspace(root)

  if (violations.length === 0) {
    console.log('✓ check:runtime-code-sources — no runtime code loading in shipped source')
    return
  }

  console.error(`✗ check:runtime-code-sources — ${violations.length} violation(s):\n`)
  for (const v of violations) {
    console.error(
      `  ${v.file}:${v.line}\n` +
        `    dynamic code loading (workers, importScripts, script injection, eval/new Function) needs a reviewed entry in check-runtime-code-sources.mjs's ALLOWED — and an origin the CSP can name`,
    )
  }
  process.exit(1)
}

if (isMainEntryPoint(import.meta.url)) {
  await main()
}
