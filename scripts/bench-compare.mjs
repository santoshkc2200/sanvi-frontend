#!/usr/bin/env node
/**
 * `pnpm bench:compare <a> <b> [--threshold 0.2]`
 *
 * Diffs two bench artifacts (`benchmarks/frontend/<name>.json` or file paths)
 * per metric and fails on a regression beyond the threshold (default 20% —
 * reporting-phase looseness; TASK-022 tightens it alongside the budgets).
 *
 * The comparison refuses — exits 2 without reporting any difference — when
 * the two artifacts ran under different profiles. Two numbers from different
 * throttling, browser, or tooling versions are not comparable, and dressing
 * that up as a delta would be worse than refusing.
 *
 * Direction: file sizes (KB) and axe violation counts are lower-is-better;
 * Lighthouse category scores are higher-is-better. Missing/null values on
 * either side are skipped rather than invented.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { findWorkspaceRoot } from '@sanvi/lint-gates/perf-profiles'
import { isMainEntryPoint } from '@sanvi/lint-gates/walk-files'

const ROOT = findWorkspaceRoot()
const BENCH_DIR = join(ROOT, 'benchmarks', 'frontend')

function parseArgs(argv) {
  const args = { threshold: 0.2, positional: [] }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--threshold') args.threshold = Number(argv[++i])
    else args.positional.push(argv[i])
  }
  if (args.positional.length !== 2) {
    console.error('Usage: bench-compare <artifact-a> <artifact-b> [--threshold 0.2]')
    process.exit(2)
  }
  return args
}

function resolveArtifact(nameOrPath) {
  const path = nameOrPath.includes('/') ? nameOrPath : join(BENCH_DIR, `${nameOrPath}.json`)
  if (!existsSync(path)) {
    console.error(`bench-compare: artifact not found: ${path}`)
    process.exit(2)
  }
  return JSON.parse(readFileSync(path, 'utf8'))
}

/**
 * Every comparable metric as a flat list. Each entry: { path, a, b, lowerIsBetter }.
 * @returns {{ path: string, a: number|null, b: number|null, lowerIsBetter: boolean }[]}
 */
export function comparableMetrics(a, b) {
  /** @type {{ path: string, a: number|null, b: number|null, lowerIsBetter: boolean }[]} */
  const metrics = []

  for (const [app, budget] of Object.entries(a.budget ?? {})) {
    metrics.push({
      path: `budget.${app}.initialKb`,
      a: budget.initialKb ?? null,
      b: b.budget?.[app]?.initialKb ?? null,
      lowerIsBetter: true,
    })
    metrics.push({
      path: `budget.${app}.totalKb`,
      a: budget.totalKb ?? null,
      b: b.budget?.[app]?.totalKb ?? null,
      lowerIsBetter: true,
    })
    const bRoutes = new Map((b.budget?.[app]?.routes ?? []).map((r) => [r.id, r.kb]))
    for (const route of budget.routes ?? []) {
      metrics.push({
        path: `budget.${app}.route[${route.id}]`,
        a: route.kb,
        b: bRoutes.get(route.id) ?? null,
        lowerIsBetter: true,
      })
    }
  }

  const LH_LOWER = ['lcpMs', 'tbtMs', 'cls']
  const LH_HIGHER = ['performance', 'accessibility', 'bestPractices', 'seo']
  for (const [app, urls] of Object.entries(a.lighthouse?.apps ?? {})) {
    for (const [url, summary] of Object.entries(urls)) {
      for (const metric of LH_LOWER) {
        metrics.push({
          path: `lighthouse.${app}${url}.${metric}`,
          a: summary[metric] ?? null,
          b: b.lighthouse?.apps?.[app]?.[url]?.[metric] ?? null,
          lowerIsBetter: true,
        })
      }
      for (const metric of LH_HIGHER) {
        metrics.push({
          path: `lighthouse.${app}${url}.${metric}`,
          a: summary[metric] ?? null,
          b: b.lighthouse?.apps?.[app]?.[url]?.[metric] ?? null,
          lowerIsBetter: false,
        })
      }
    }
  }

  for (const key of ['critical', 'serious', 'moderate', 'minor', 'uncovered']) {
    metrics.push({
      path: `axe.totals.${key}`,
      a: a.axe?.totals?.[key] ?? null,
      b: b.axe?.totals?.[key] ?? null,
      lowerIsBetter: true,
    })
  }

  return metrics
}

/**
 * Relative regression vs `a` in [0, ∞); negative means improvement. Zero
 * baselines are compared absolutely (b > 0 is a regression, else no delta).
 */
export function regressionRatio(a, b, lowerIsBetter) {
  if (a === null || b === null) return null
  const signed = lowerIsBetter ? b - a : a - b
  if (a === 0) return signed > 0 ? Number.POSITIVE_INFINITY : 0
  return signed / Math.abs(a)
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const a = resolveArtifact(args.positional[0])
  const b = resolveArtifact(args.positional[1])

  const profileA = JSON.stringify(a.meta?.profile)
  const profileB = JSON.stringify(b.meta?.profile)
  if (profileA !== profileB) {
    console.error(
      'bench-compare: refusing to compare — the two artifacts ran under different profiles.',
    )
    console.error(`  ${args.positional[0]}: pins ${JSON.stringify(a.meta?.profile?.pins)}`)
    console.error(`  ${args.positional[1]}: pins ${JSON.stringify(b.meta?.profile?.pins)}`)
    process.exit(2)
  }

  const regressions = []
  let compared = 0
  for (const metric of comparableMetrics(a, b)) {
    const ratio = regressionRatio(metric.a, metric.b, metric.lowerIsBetter)
    if (ratio === null) continue
    compared += 1
    if (ratio >= args.threshold) {
      regressions.push({ ...metric, ratio })
    }
  }

  console.log(
    `Compared ${compared} metrics between "${args.positional[0]}" and "${args.positional[1]}" (threshold ${args.threshold}).`,
  )

  if (regressions.length === 0) {
    console.log('✓ No regression beyond threshold.')
    return
  }

  console.log(`✗ ${regressions.length} metric(s) regressed:`)
  for (const regression of regressions) {
    const percent =
      regression.ratio === Number.POSITIVE_INFINITY
        ? '∞ (from zero)'
        : `${(regression.ratio * 100).toFixed(1)}%`
    console.log(
      `    ${regression.path}: ${metricDisplay(regression.a)} → ${metricDisplay(regression.b)} (+${percent})`,
    )
  }
  process.exit(1)
}

function metricDisplay(value) {
  if (value === null || value === undefined) return 'n/a'
  return typeof value === 'number' ? Number(value.toFixed(4)) : value
}

if (isMainEntryPoint(import.meta.url)) {
  main()
}
