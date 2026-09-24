#!/usr/bin/env node
/**
 * The CSP-declared-in-one-place gate (phase 11, TASK-024): every Content-
 * Security-Policy source and every relaxation must come from
 * `packages/csp` — the non-negotiable "every app declares its CSP through
 * `@sanvi/csp`", enforced by scan rather than convention. Fails on any
 * shipped-source file outside the package that spells a policy source
 * (`unsafe-inline`, `unsafe-eval`, `frame-ancestors`, `default-src`, …),
 * except:
 *
 *   - `packages/csp/**` — the builder itself;
 *   - tests and e2e specs, which *assert* on policies;
 *   - code lines carrying the trailing `sanvi-csp: dev-only` marker — the
 *     three dev branches (`vite dev` injects component CSS as runtime
 *     `<style>` elements; production extracts CSS to files, so the flag
 *     never reaches a built policy).
 *
 * Comments are stripped before scanning (same hand-rolled scanner trade-off
 * as `check-platform-literals`): prose that explains the policy is
 * documentation, a source token in code is the violation. The marker is
 * therefore checked on the *stripped* line — i.e. it must trail the code
 * itself, not sit in a comment block above.
 */
import { readFileSync } from 'node:fs'
import { extname, relative } from 'node:path'
import { isMainEntryPoint, walkFiles } from './walk-files.mjs'
import { stripComments } from './check-platform-literals.mjs'

const POLICY_TOKENS = [
  'unsafe-inline',
  'unsafe-eval',
  'unsafe-hashes',
  'default-src',
  'script-src',
  'style-src',
  'frame-ancestors',
]

const MARKER = 'sanvi-csp: dev-only'

/**
 * Explicit exceptions, as `${relativePath}:${token}` pairs — data instead of
 * hidden conventions. Each entry was reviewed in TASK-024; a new one is a
 * change to this file, not a silent scan skip.
 */
const ALLOWED = new Set([
  // The storefront hook names the `style-src` directive to inject the
  // per-request theme CSS hash into it — plumbing, not a policy decision.
  'apps/storefront/src/hooks.server.ts:style-src',
  // The dev branches (see the trailing markers at each site): `vite dev`
  // injects component CSS as runtime `<style>` elements; production
  // extracts CSS to files, so the inline allowance never reaches a build.
  'apps/storefront/svelte.config.js:style-src',
  'apps/storefront/svelte.config.js:unsafe-inline',
  'apps/marketing/svelte.config.js:style-src',
  'apps/marketing/svelte.config.js:unsafe-inline',
  'apps/marketing/src/hooks.server.ts:style-src',
  'apps/marketing/src/hooks.server.ts:unsafe-inline',
])

/** Paths whose whole job is CSP policy construction. Relative to the scanned root. */
function isCspPackage(relativePath) {
  const normalized = relativePath.split('\\').join('/')
  return normalized.startsWith('packages/csp/')
}

/** Tests assert on policies; they are the checker, not the checked. */
function isTestPath(relativePath) {
  const normalized = relativePath.split('\\').join('/')
  return (
    /(^|\/)(__tests__|tests|e2e)(\/|$)/.test(normalized) ||
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(normalized) ||
    /\.stories\.svelte$/.test(normalized) ||
    normalized.endsWith('vitest.config.ts') ||
    normalized.endsWith('playwright.config.ts')
  )
}

export function scanWorkspace(root) {
  const violations = []
  const extensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.svelte', '.html'])

  for (const file of walkFiles(root, (name) => extensions.has(extname(name)))) {
    const relativePath = relative(root, file)
    if (isCspPackage(relativePath) || isTestPath(relativePath)) continue
    // The gate's own source names the tokens it scans for.
    if (relativePath.endsWith('check-csp.mjs')) continue
    // Generated artifacts (Lighthouse HTML reports, staged private source
    // maps) live under dot-directories — they quote policies but ship
    // nothing.
    if (relativePath.split(/[/\\]/).some((segment) => segment.startsWith('.'))) continue

    const source = readFileSync(file, 'utf8')
    const strippedLines = stripComments(source, extname(file) === '.svelte').split('\n')
    const rawLines = source.split('\n')
    for (let i = 0; i < strippedLines.length; i += 1) {
      const line = strippedLines[i]
      if (!line) continue
      const lower = line.toLowerCase()
      const hit = POLICY_TOKENS.find((token) => lower.includes(token))
      if (!hit) continue
      if (ALLOWED.has(`${relativePath.split('\\').join('/')}:${hit}`)) continue
      // The dev-branch escape: the marker must trail the code on the same
      // line (the comment-stripped line still carries it — the marker is
      // matched against the raw line here), so every exception sits next to
      // its reason instead of in a comment block above.
      if (rawLines[i]?.includes(MARKER)) continue
      violations.push({ file: relativePath, line: i + 1, token: hit })
    }
  }
  return violations
}

async function main() {
  const root = process.argv[2]
  if (!root) {
    console.error('Usage: sanvi-check-csp <workspace-root>')
    process.exit(2)
  }

  const violations = scanWorkspace(root)

  if (violations.length === 0) {
    console.log('✓ check:csp — every policy source is declared in packages/csp')
    return
  }

  console.error(`✗ check:csp — ${violations.length} violation(s):\n`)
  for (const v of violations) {
    console.error(
      `  ${v.file}:${v.line}  "${v.token}"\n` +
        `    CSP sources are declared only in packages/csp — a dev-mode exception needs a trailing "${MARKER}" marker comment, anything else belongs in the package's builders`,
    )
  }
  process.exit(1)
}

if (isMainEntryPoint(import.meta.url)) {
  await main()
}
