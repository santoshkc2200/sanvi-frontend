#!/usr/bin/env node
/**
 * `pnpm check:async-audit`
 *
 * Asserts `docs/ux/async-state-audit.md` covers **every** route enumerated
 * live from each app's route definitions — TASK-023 step 1's "the audit
 * covers every route, verified against the route manifest" — and that the
 * audit carries no entries for routes that no longer exist.
 *
 * The SvelteKit enumeration reads the *built* server manifest
 * (`.svelte-kit/output/server/manifest-full.js`), so run `pnpm build` first;
 * in `check:all` that ordering is already true. The comparison logic lives
 * in `@sanvi/lint-gates/check-async-audit` (unit-tested there); this file is
 * the workspace wiring.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadBudgets } from '@sanvi/lint-gates/check-budget'
import { compareAuditWithRoutes, parseAuditRoutes } from '@sanvi/lint-gates/check-async-audit'
import { findWorkspaceRoot } from '@sanvi/lint-gates/perf-profiles'
import { listRoutes } from '@sanvi/lint-gates/routes'

const ROOT = findWorkspaceRoot()
const DOC = join(ROOT, 'docs', 'ux', 'async-state-audit.md')

let markdown
try {
  markdown = readFileSync(DOC, 'utf8')
} catch {
  console.error(
    `check:async-audit: docs/ux/async-state-audit.md does not exist.\n` +
      'The route-by-route audit is a deliverable (TASK-023 step 1) — write it, then re-run.',
  )
  process.exit(1)
}

const budgets = loadBudgets({ root: ROOT })
/** @type {Record<string, string[]>} */
const enumerated = {}
for (const [app, config] of Object.entries(budgets.apps)) {
  const routes = listRoutes(join(ROOT, 'apps', app), config.type)
  if (routes === null) {
    console.error(
      `check:async-audit: could not enumerate routes for "${app}" — ` +
        (config.type === 'sveltekit'
          ? 'no built server manifest found; run `pnpm build` first.'
          : 'src/App.svelte not found.'),
    )
    process.exit(2)
  }
  enumerated[app] = routes.map((route) => route.id)
}

const result = compareAuditWithRoutes(parseAuditRoutes(markdown), enumerated)

for (const [app, routes] of Object.entries(result.missing)) {
  console.error(`\n${app}: ${routes.length} route(s) missing from the audit:`)
  for (const route of routes) console.error(`  - ${route}`)
}
for (const [app, routes] of Object.entries(result.stale)) {
  console.error(`\n${app}: ${routes.length} audited route(s) not in the current manifest:`)
  for (const route of routes) console.error(`  - ${route}`)
}

if (!result.ok) {
  console.error(
    '\ncheck:async-audit: the audit and the route manifest disagree — update docs/ux/async-state-audit.md.',
  )
  process.exit(1)
}
const total = Object.values(enumerated).reduce((sum, routes) => sum + routes.length, 0)
console.log(
  `check:async-audit ok — ${total} routes across ${Object.keys(enumerated).length} apps, all audited`,
)
