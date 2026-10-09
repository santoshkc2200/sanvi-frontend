#!/usr/bin/env node
/**
 * `pnpm check:lighthouse [--report-only] [--apps a,b] [--out <file>]`
 *
 * Runs Lighthouse CI per app per locale against each app's built output,
 * under the pinned profile in `scripts/perf-profiles.json`. Consolidates the
 * per-run reports into one artifact (default `benchmarks/frontend/lighthouse.json`)
 * with the profile block embedded, and prints a table plus the run-to-run
 * variance TASK-031's DoD requires recording.
 *
 * TASK-022 made the default run **blocking**: medians are asserted against
 * the caps in `scripts/budgets.json`'s `lighthouse` section (calibrated
 * against `benchmarks/frontend/VARIANCE.md`; see {@linkcode assertLighthouseCaps}).
 * `--report-only` collects and prints without asserting. Lighthouse is
 * Chromium-only, so per the profiles file it runs the SSR apps (storefront,
 * marketing) in both locales via their `/{locale}` URL prefixes, and the
 * SPAs in the default locale only — their locale signal is a cookie
 * Lighthouse cannot set. The axe sweep covers both locales for every app;
 * this gap is recorded in the artifact, not papered over.
 *
 * Requires a build first (`pnpm build`): the harness serves build output, not
 * dev servers, because a number from a dev server is not a number about the product.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { delimiter, join } from 'node:path'
import { findWorkspaceRoot, loadPerfProfiles } from '@sanvi/lint-gates/perf-profiles'
import { isMainEntryPoint } from '@sanvi/lint-gates/walk-files'
import { startStorefrontMockApi } from './lib/serving.mjs'

const ROOT = findWorkspaceRoot()
const PROFILES = loadPerfProfiles({
  root: ROOT,
}) /** Mirrors `APPS` in `lighthouserc.cjs` — the runner needs URL lists the LHCI
 * config doesn't hand back. Ports, server commands, and the Windows env-prefix
 * split-out (`APP_SERVER_ENV`) live only there. */
const { APPS, APP_SERVER_ENV } = createRequire(import.meta.url)(join(ROOT, 'lighthouserc.cjs'))

function parseArgs(argv) {
  const args = {
    reportOnly: false,
    apps: Object.keys(APPS),
    out: join(ROOT, 'benchmarks', 'frontend', 'lighthouse.json'),
  }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--report-only') args.reportOnly = true
    else if (argv[i] === '--apps') args.apps = argv[++i].split(',')
    else if (argv[i] === '--out') args.out = argv[++i]
  }
  for (const app of args.apps) {
    if (!APPS[app]) {
      console.error(
        `check:lighthouse: unknown app "${app}" — known: ${Object.keys(APPS).join(', ')}`,
      )
      process.exit(2)
    }
  }
  return args
}

/**
 * Chrome resolution order: $CHROME_PATH, then the Playwright browser cache
 * the repo already uses (e2e and axe sweep run the same binary). A version
 * that drifts from `pins.chrome` fails even in report-only mode — a runner
 * upgrade is a deliberate commit to the profiles file, not ambient drift.
 */
function resolveChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  const cacheRoot = join(process.env.HOME ?? '', 'Library', 'Caches', 'ms-playwright')
  const linuxRoot = join(process.env.HOME ?? '', '.cache', 'ms-playwright')
  for (const root of [cacheRoot, linuxRoot]) {
    if (!isDirectory(root)) continue
    const candidates = readdirSync(root)
      .filter((n) => n.startsWith('chromium-'))
      .sort()
      .reverse()
    for (const dir of candidates) {
      for (const rel of [
        join(
          dir,
          'chrome-mac-arm64',
          'Google Chrome for Testing.app',
          'Contents',
          'MacOS',
          'Google Chrome for Testing',
        ),
        join(
          dir,
          'chrome-mac',
          'Google Chrome for Testing.app',
          'Contents',
          'MacOS',
          'Google Chrome for Testing',
        ),
        join(dir, 'chrome-linux', 'chrome'),
      ]) {
        const full = join(root, rel)
        if (existsSync(full)) return full
      }
    }
  }
  console.error(
    'check:lighthouse: no Chrome found. Set CHROME_PATH or `pnpm exec playwright install chromium`.',
  )
  process.exit(2)
}

function isDirectory(path) {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

function chromeVersion(binary) {
  if (process.platform === 'win32') {
    // `chrome.exe --version` neither prints nor exits on Windows — read the
    // version resource instead. The pin check below is the same either way.
    return execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `(Get-Item -LiteralPath '${binary.replaceAll("'", "''")}').VersionInfo.ProductVersion`,
      ],
      { encoding: 'utf8' },
    ).trim()
  }
  return execFileSync(binary, ['--version'], { encoding: 'utf8' })
    .trim()
    .replace(/^.*?([\d.]+).*$/, '$1')
}

/**
 * Median across runs, per metric, plus the max-min spread the DoD wants
 * recorded — a gate threshold set below the noise floor is a gate someone
 * disables in week one, and that judgement needs the spread on record.
 */
function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function extractRun(report) {
  return {
    lcpMs: Math.round(report.audits['largest-contentful-paint']?.numericValue ?? -1),
    tbtMs: Math.round(report.audits['total-blocking-time']?.numericValue ?? -1),
    cls: Number((report.audits['cumulative-layout-shift']?.numericValue ?? -1).toFixed(4)),
    performance: report.categories?.performance?.score ?? -1,
    accessibility: report.categories?.accessibility?.score ?? -1,
    bestPractices: report.categories?.['best-practices']?.score ?? -1,
    seo: report.categories?.seo?.score ?? -1,
    // Host CPU speed under emulation — devtools throttling multiplies host
    // latency, so absolute lab milliseconds travel badly between machines
    // even at identical pins. Recorded, not compared: rc.1 (macOS) vs rc.3
    // (Windows) LCP deltas are platform, and saying so needs this number.
    benchmarkIndex: Number((report.environment?.benchmarkIndex ?? -1).toFixed(1)),
  }
}

const METRICS = [
  'lcpMs',
  'tbtMs',
  'cls',
  'performance',
  'accessibility',
  'bestPractices',
  'seo',
  'benchmarkIndex',
]

function summarize(runs) {
  const summary = { runs: runs.length }
  for (const metric of METRICS) {
    const values = runs.map((r) => r[metric]).filter((v) => v >= 0)
    summary[metric] = values.length === 0 ? null : Number(median(values).toFixed(4))
    summary[`${metric}Spread`] =
      values.length === 0 ? null : Number((Math.max(...values) - Math.min(...values)).toFixed(4))
  }
  return summary
}

/**
 * Collects Lighthouse metrics for the given apps and returns the artifact
 * object (not written to disk — callers decide where it lands).
 * @param {{ apps: string[] }} options
 */
export async function collectLighthouse({ apps }) {
  const chrome = resolveChrome()
  const chromeVer = chromeVersion(chrome)
  if (chromeVer !== PROFILES.pins.chrome) {
    throw new Error(
      `check:lighthouse: Chrome ${chromeVer} at ${chrome} does not match pins.chrome ${PROFILES.pins.chrome} in scripts/perf-profiles.json — update the pin deliberately or install the pinned browser.`,
    )
  }

  const artifact = {
    harness: 'lighthouse',
    generatedAt: new Date().toISOString(),
    lab: true,
    profile: { pins: PROFILES.pins, harness: PROFILES.harnesses.lighthouse, chromeBinary: chrome },
    localeCoverage: PROFILES.meta.localeCoverageNote,
    buildSha: null,
    apps: {},
  }
  try {
    artifact.buildSha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim()
  } catch {
    // detached/foreign VCS checkout — artifact still records its profile
  }

  // The storefront 500s every page without a backend to resolve tenants
  // against; its e2e mock API is the stand-in (see lib/serving.mjs).
  const mockApi = apps.includes('storefront') ? await startStorefrontMockApi() : null

  // LHCI starts preview servers through a bare shell, which does not have
  // pnpm's per-package node_modules/.bin on PATH (`vite preview` et al). On
  // Windows the shell is cmd.exe, so the per-app config hands lhci the bare
  // command and the split-out env assignments flow through this process env —
  // lhci's server children inherit them (see lighthouserc.cjs splitEnvPrefix).
  const pathPrefix = [
    join(ROOT, 'node_modules', '.bin'),
    ...apps.map((app) => join(ROOT, 'apps', app, 'node_modules', '.bin')),
    process.env.PATH ?? '',
  ].join(delimiter)
  // The package's own JS entry, not the node_modules/.bin shim — the shim has
  // no .exe/.cmd-free form Windows can exec, and node runs the entry identically.
  const lhciEntry = createRequire(import.meta.url).resolve('@lhci/cli/src/cli.js')

  try {
    for (const app of apps) {
      const appDir = join(ROOT, 'apps', app)
      const outputDir = join(appDir, '.lighthouseci')
      rmSync(outputDir, { recursive: true, force: true })

      console.log(`\n==> ${app} (${APPS[app].urls.join(', ')}) — lhci collect`)
      execFileSync(
        process.execPath,
        [lhciEntry, 'collect', `--config=${join(appDir, 'lighthouserc.cjs')}`],
        {
          cwd: appDir,
          env: {
            ...process.env,
            CHROME_PATH: chrome,
            PATH: pathPrefix,
            ...(process.platform === 'win32' ? APP_SERVER_ENV[app] : null),
          },
          stdio: ['ignore', process.stderr, process.stderr],
        },
      )

      const reportsDir = existsSync(outputDir) ? outputDir : join(ROOT, '.lighthouseci')
      const reports = readdirSync(reportsDir).filter(
        (f) => f.startsWith('lhr-') && f.endsWith('.json'),
      )
      /** @type {Record<string, { raw: object[] }>} */
      const byUrl = {}
      for (const file of reports) {
        const report = JSON.parse(readFileSync(join(reportsDir, file), 'utf8'))
        const url = new URL(report.requestedUrl)
        byUrl[url.pathname] ??= { raw: [] }
        byUrl[url.pathname].raw.push(extractRun(report))
      }
      artifact.apps[app] = {}
      for (const [pathname, { raw }] of Object.entries(byUrl)) {
        artifact.apps[app][pathname] = {
          locale: pathname.startsWith('/ja') ? 'ja' : 'en',
          ...summarize(raw),
        }
      }
    }
  } finally {
    mockApi?.stop()
  }

  return artifact
}

function printLighthouseReport(artifact) {
  for (const [app, urls] of Object.entries(artifact.apps)) {
    console.log(`\n==> ${app} (lab, pinned midrange-android profile)`)
    for (const [pathname, summary] of Object.entries(urls)) {
      console.log(
        `  ${pathname} [${summary.locale}]  LCP ${summary.lcpMs}ms  TBT ${summary.tbtMs}ms  CLS ${summary.cls}  perf ${summary.performance}  (runs: ${summary.runs})`,
      )
      const spreads = METRICS.filter((m) => summary[`${m}Spread`] !== null).map(
        (m) => `${m} ±${summary[`${m}Spread`]}`,
      )
      console.log(`    run-to-run spread: ${spreads.join('  ')}`)
    }
  }
}

/**
 * TASK-022's blocking assertions. Caps live in `scripts/budgets.json`'s
 * `lighthouse` section, per app per URL: `lcpMs`/`tbtMs`/`cls` are
 * lower-is-better maximums, `performance`/`seo`/`bestPractices`/
 * `accessibility` are minimums (omit what you do not want asserted).
 *
 * Threshold calibration comes from `benchmarks/frontend/VARIANCE.md`:
 * median LCP is stable to ~6 % and category scores to ±0.02 on a fixed
 * build, so absolute caps on medians-of-3 are meaningful. Millisecond caps
 * carry host headroom on top of the local measurement (devtools throttling
 * multiplies *host* latency — `benchmarkIndex` records the class) — the
 * DoD's own ≤ 2.0 s / ≤ 200 ms evidence is the committed rc artifact, not
 * a CI runner. Scores and CLS are dimensionless and asserted tightly.
 */
const LOWER_IS_BETTER = new Set(['lcpMs', 'tbtMs', 'cls'])
const HIGHER_IS_BETTER = new Set(['performance', 'seo', 'bestPractices', 'accessibility'])

/**
 * @param {object} artifact a collectLighthouse result
 * @param {object} budgets the parsed budgets.json
 * @returns {{ ok: boolean, failures: string[], checked: number }}
 */
export function assertLighthouseCaps(artifact, budgets) {
  const caps = budgets.lighthouse ?? {}
  const failures = []
  let checked = 0
  for (const [app, urls] of Object.entries(caps)) {
    if (app.startsWith('_')) continue // `_readme` and friends — config, not an app
    for (const [url, limits] of Object.entries(urls)) {
      const summary = artifact.apps?.[app]?.[url]
      if (!summary) {
        failures.push(`${app}${url}: no Lighthouse result to assert against (was it collected?)`)
        continue
      }
      for (const [metric, limit] of Object.entries(limits)) {
        const value = summary[metric]
        if (typeof value !== 'number' || typeof limit !== 'number') continue
        checked += 1
        if (LOWER_IS_BETTER.has(metric) && value > limit) {
          failures.push(`${app}${url}.${metric}: ${value} > cap ${limit}`)
        } else if (HIGHER_IS_BETTER.has(metric) && value < limit) {
          failures.push(`${app}${url}.${metric}: ${value} < floor ${limit}`)
        }
      }
    }
  }
  return { ok: failures.length === 0, failures, checked }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const artifact = await collectLighthouse({ apps: args.apps })
  writeFileSync(args.out, `${JSON.stringify(artifact, null, 2)}\n`)
  printLighthouseReport(artifact)
  console.log(`\nArtifact: ${args.out}`)

  if (args.reportOnly) {
    console.log('report-only — assertions skipped (TASK-022 made the default run blocking)')
    return
  }

  const budgets = JSON.parse(readFileSync(join(ROOT, 'scripts', 'budgets.json'), 'utf8'))
  const verdict = assertLighthouseCaps(artifact, budgets)
  if (verdict.checked === 0) {
    console.error('✗ check:lighthouse: no assertions configured in budgets.json lighthouse section')
    process.exit(1)
  }
  if (!verdict.ok) {
    console.error(`✗ ${verdict.failures.length} Lighthouse assertion(s) failed:`)
    for (const failure of verdict.failures) {
      console.error(`    ${failure}`)
    }
    process.exit(1)
  }
  console.log(`✓ ${verdict.checked} Lighthouse assertion(s) inside their caps`)
}

if (isMainEntryPoint(import.meta.url)) {
  await main()
}
