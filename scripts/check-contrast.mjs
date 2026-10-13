#!/usr/bin/env node
/**
 * `pnpm check:contrast [--themes=published|defaults]`
 *
 * The theme contrast gate (TASK-027 step 6). The phase-07 vitest gates
 * check the default design-token sets; testing defaults proves nothing
 * about tenant themes, so this gate runs the same WCAG math over the
 * **published** theme population — `scripts/published-themes.json`, the
 * mirror of what real tenants run. Blocking: any violation fails, naming
 * the theme, the pair, the ratio, and the minimum.
 *
 * `--themes=defaults` re-checks the default tenant-token vocabulary (what
 * an untouched theme resolves to) instead. The shared engine is
 * `@sanvi/design-tokens`' contrast module — the same one the admin draft
 * checker and the publish gate run, which is also what the backend's Rust
 * mirror computes.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
// The engine ships through design-tokens' build (dist/ts) — imported by
// path because the workspace root's package.json does not depend on it.
const { checkContrast } = await import(
  pathToFileURL(join(ROOT, 'packages', 'design-tokens', 'dist', 'ts', 'index.js')).href
)

function parseArgs(argv) {
  const args = { themes: 'published' }
  for (let i = 0; i < argv.length; i += 1) {
    // Both flag spellings: the task's verify line uses `--themes=published`.
    const equals = argv[i]?.startsWith('--themes=')
    if (argv[i] === '--themes') args.themes = argv[++i]
    else if (equals) args.themes = argv[i].slice('--themes='.length)
  }
  if (args.themes !== 'published' && args.themes !== 'defaults') {
    console.error(`check:contrast: unknown --themes "${args.themes}" — published or defaults`)
    process.exit(2)
  }
  return args
}

function checkTokenSet(label, tokens) {
  const violations = checkContrast(tokens)
  if (violations.length === 0) {
    console.log(`  ${label}: pass`)
    return 0
  }
  for (const v of violations) {
    console.error(
      `  ${label}: FAIL ${v.foreground} (${v.foregroundValue}) on ${v.background} (${v.backgroundValue})` +
        ` — ${v.ratio}:1 < ${v.minimum}:1`,
    )
  }
  return violations.length
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const published = JSON.parse(readFileSync(join(ROOT, 'scripts', 'published-themes.json'), 'utf8'))

  let failures = 0
  if (args.themes === 'defaults') {
    console.log('check:contrast — the default tenant-token vocabulary:')
    failures += checkTokenSet('defaults', published.defaultTokens)
  } else {
    console.log(`check:contrast — ${published.themes.length} published theme(s):`)
    for (const theme of published.themes) {
      const merged = { ...published.defaultTokens, ...theme.overrides }
      failures += checkTokenSet(theme.key, merged)
    }
  }

  if (failures > 0) {
    console.error(`\ncheck:contrast: BLOCKING — ${failures} violation(s)`)
    process.exit(1)
  }
  console.log('\ncheck:contrast: gate passed')
}

await main()
