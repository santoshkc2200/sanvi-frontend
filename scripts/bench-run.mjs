#!/usr/bin/env node
/**
 * `pnpm bench:run [name] [--apps a,b]`
 *
 * One full run of all three harnesses (budget, Lighthouse, axe) across the
 * apps, committed as a single comparable artifact with the profile block
 * embedded — `benchmarks/frontend/<name>.json`, default a timestamped file
 * under `benchmarks/frontend/`. `pnpm bench:run baseline` refreshes the
 * committed baseline; `pnpm bench:compare` diffs any two artifacts and
 * refuses cross-profile comparisons.
 *
 * Requires a build first (`pnpm build`): every harness measures build output.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadBudgets, runAppBudgetCheck } from '@sanvi/lint-gates/check-budget'
import { findWorkspaceRoot, loadPerfProfiles } from '@sanvi/lint-gates/perf-profiles'
import { isMainEntryPoint } from '@sanvi/lint-gates/walk-files'
import { sweepA11y } from './check-a11y.mjs'
import { collectLighthouse } from './check-lighthouse.mjs'

const ROOT = findWorkspaceRoot()
const PROFILES = loadPerfProfiles({ root: ROOT })
const BENCH_DIR = join(ROOT, 'benchmarks', 'frontend')

function parseArgs(argv) {
  const args = { name: `run-${new Date().toISOString().replace(/[:.]/g, '-')}`, apps: null }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--apps') args.apps = argv[++i].split(',')
    else if (!args.name || args.name.startsWith('run-'))
      if (!argv[i].startsWith('--')) args.name = argv[i]
  }
  return args
}

function budgetSection({ apps }) {
  const budgets = loadBudgets({ root: ROOT })
  const names = apps ?? Object.keys(budgets.apps)
  const unknown = names.filter((name) => !budgets.apps[name])
  if (unknown.length > 0) {
    console.error(
      `bench-run: unknown app(s): ${unknown.join(', ')} — known: ${Object.keys(budgets.apps).join(', ')}`,
    )
    process.exit(2)
  }
  const section = {}
  for (const name of names) {
    const result = runAppBudgetCheck({ name, config: budgets.apps[name], root: ROOT })
    section[name] = {
      type: budgets.apps[name].type,
      initialKb: result.initialKbTotal,
      initialBudgetKb: result.initialKb,
      totalKb: Number(result.totalKb.toFixed(2)),
      routeKb: result.routeKb,
      routes: result.routes.map((r) => ({
        id: r.id,
        kb: r.kb === null ? null : Number(r.kb.toFixed(2)),
      })),
      routesMissing: result.routesMissing,
      ok: result.ok,
    }
  }
  return section
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  let buildSha = null
  try {
    buildSha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim()
  } catch {
    // non-git checkout — the profile block still identifies the run conditions
  }

  const apps = args.apps ?? Object.keys(loadBudgets({ root: ROOT }).apps)

  console.log('==> budget (static, off the last build)')
  const budget = budgetSection({ apps })
  for (const [name, entry] of Object.entries(budget)) {
    console.log(
      `  ${name}: initial ${entry.initialKb === null ? 'n/a' : `${entry.initialKb.toFixed(1)} KB`}, ${entry.routes.length} routes, ok=${entry.ok}`,
    )
  }

  const lighthouse = await collectLighthouse({ apps })
  const axe = await sweepA11y({ apps, locales: PROFILES.harnesses.axe.locales })

  const artifact = {
    meta: {
      generatedAt: new Date().toISOString(),
      buildSha,
      lab: true,
      // The whole profiles document travels with every artifact: bench-compare
      // refuses to compare artifacts whose profiles differ.
      profile: PROFILES,
    },
    budget,
    lighthouse,
    axe,
  }

  const outPath = join(BENCH_DIR, `${args.name}.json`)
  mkdirSync(BENCH_DIR, { recursive: true })
  writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`)
  console.log(`\nArtifact: ${outPath}`)
}

if (isMainEntryPoint(import.meta.url)) {
  await main()
}
