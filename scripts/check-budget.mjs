#!/usr/bin/env node
/**
 * Root `check:budget` entry.
 *
 * - default: `turbo run check:budget` — the blocking per-app gate, cached,
 *   exactly what `check:all` and CI have always run.
 * - `--report-only`: the phase-11 whole-workspace report (per-app AND
 *   per-route table across every app in `scripts/budgets.json`, never
 *   fails). Routed around turbo because turbo only forwards task args after
 *   a `--` separator and rejects unknown flags otherwise.
 */
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { findWorkspaceRoot } from '@sanvi/lint-gates/perf-profiles'

const root = findWorkspaceRoot()
const args = process.argv.slice(2)

if (args.includes('--report-only')) {
  execFileSync(
    process.execPath,
    [join(root, 'packages', 'lint-gates', 'src', 'check-budget.mjs'), '--all', ...args],
    {
      stdio: 'inherit',
      cwd: root,
    },
  )
} else {
  execFileSync(join(root, 'node_modules', '.bin', 'turbo'), ['run', 'check:budget', ...args], {
    stdio: 'inherit',
    cwd: root,
  })
}
