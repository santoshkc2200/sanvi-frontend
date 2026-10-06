#!/usr/bin/env node
/**
 * `pnpm check:a11y [--report-only] [--apps a,b] [--locales en,ja] [--out <file>]`
 *
 * The axe sweep (TASK-031, reporting-only; blocking in TASK-027): axe across
 * every route of all four apps in both locales, under the pinned profile in
 * `scripts/perf-profiles.json`.
 *
 * Route coverage is asserted alongside the findings, because coverage is what
 * makes the gate survive phases 09 and 10 adding routes: the routes actually
 * swept come from the committed `scripts/a11y-routes.json`, while coverage is
 * computed against the routes **enumerated live from each app's route
 * definitions** (`@sanvi/lint-gates/routes`). A route that lands without a
 * sweep-list entry shows up as uncovered — the conscious act of adding it to
 * the sweep list is the same act as budgeting it. The artifact records both
 * lists so the diff is auditable, and `--enforce-coverage` turns the report
 * into a failure (TASK-027 flips it on).
 *
 * Pages are swept as the harness can serve them: the SPAs' auth-gated routes
 * render their login redirect without a session — still honest axe entries
 * for what actually renders. Deep authenticated sweeps with mock backends are
 * TASK-027's work.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { loadBudgets } from '@sanvi/lint-gates/check-budget'
import { findWorkspaceRoot, loadPerfProfiles } from '@sanvi/lint-gates/perf-profiles'
import { listRoutes } from '@sanvi/lint-gates/routes'
import { isMainEntryPoint } from '@sanvi/lint-gates/walk-files'
import { serveApp, startStorefrontMockApi } from './lib/serving.mjs'

const require = createRequire(import.meta.url)
const ROOT = findWorkspaceRoot()
const PROFILES = loadPerfProfiles({ root: ROOT })

// Ports live in lighthouserc.cjs APPS — the serving topology has one home.
// A local copy here drifted the moment someone changed a port in the config.
const { APPS } = require(join(ROOT, 'lighthouserc.cjs'))
const PORTS = Object.fromEntries(Object.entries(APPS).map(([name, cfg]) => [name, cfg.port]))

function parseArgs(argv) {
  const args = {
    reportOnly: true,
    apps: Object.keys(PORTS),
    locales: PROFILES.harnesses.axe.locales,
    out: join(ROOT, 'benchmarks', 'frontend', 'axe.json'),
    enforceCoverage: false,
  }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--report-only') args.reportOnly = true
    else if (argv[i] === '--enforce-coverage') args.enforceCoverage = true
    else if (argv[i] === '--apps') args.apps = argv[++i].split(',')
    else if (argv[i] === '--locales') args.locales = argv[++i].split(',')
    else if (argv[i] === '--out') args.out = argv[++i]
  }
  for (const app of args.apps) {
    if (!PORTS[app]) {
      console.error(`check:a11y: unknown app "${app}" — known: ${Object.keys(PORTS).join(', ')}`)
      process.exit(2)
    }
  }
  return args
}

function loadSweepList() {
  return JSON.parse(readFileSync(join(ROOT, 'scripts', 'a11y-routes.json'), 'utf8'))
}

/**
 * Findings for one page, compact: rule id, impact, how many nodes — the full
 * node HTML stays in the runner's verbose mode, not in the committed artifact.
 */
function pageResult(violations) {
  const bySeverity = { critical: 0, serious: 0, moderate: 0, minor: 0 }
  const findings = []
  for (const violation of violations) {
    const impact = violation.impact ?? 'minor'
    bySeverity[impact] = (bySeverity[impact] ?? 0) + 1
    findings.push({ id: violation.id, impact, nodes: violation.nodes.length, help: violation.help })
  }
  return { violations: bySeverity, total: violations.length, findings }
}

/**
 * Sweeps axe across the given apps × locales and returns the artifact object
 * (not written to disk — callers decide where it lands).
 * @param {{ apps: string[], locales: string[] }} options
 */
export async function sweepA11y({ apps, locales }) {
  const { chromium, devices } = require('@playwright/test')
  const { AxeBuilder } = require('@axe-core/playwright')

  const playwrightVersion = require(
    join(ROOT, 'node_modules', '@playwright', 'test', 'package.json'),
  ).version
  if (playwrightVersion !== PROFILES.pins.playwright) {
    throw new Error(
      `check:a11y: Playwright ${playwrightVersion} does not match pins.playwright ${PROFILES.pins.playwright} in scripts/perf-profiles.json — update the pin deliberately or align the dependency.`,
    )
  }

  const sweepList = loadSweepList()
  const deviceName = PROFILES.profiles['midrange-android'].playwrightDevice ?? undefined

  const artifact = {
    harness: 'axe',
    generatedAt: new Date().toISOString(),
    lab: true,
    profile: {
      pins: PROFILES.pins,
      harness: PROFILES.harnesses.axe,
      device: deviceName ?? 'desktop-chromium',
    },
    buildSha: null,
    apps: {},
    totals: { critical: 0, serious: 0, moderate: 0, minor: 0, uncovered: 0 },
  }
  try {
    artifact.buildSha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim()
  } catch {
    // non-git checkout — the profile block still identifies the run conditions
  }

  const mockApi = apps.includes('storefront') ? await startStorefrontMockApi() : null
  // The sweep runs the pinned Chrome when the operator points CHROME_PATH at
  // it (same convention as the Lighthouse runner) — otherwise playwright's
  // own cache default, whose build can drift from pins.chrome.
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
  })

  try {
    for (const app of apps) {
      const appRoot = join(ROOT, 'apps', app)
      const sweepEntry = sweepList.apps[app]
      // No sweep entry at all is itself a coverage failure — the app landed
      // without ever being added to the sweep list. Defaulting its type would
      // enumerate via the wrong strategy and report a vacuous 0/0 pass; known
      // types come from budgets.json, the one place app shape is declared.
      const type = sweepEntry?.type ?? loadBudgets({ root: ROOT }).apps[app]?.type
      const enumerated = listRoutes(appRoot, type) ?? []
      const enumeratedIds = enumerated.map((r) => r.id)
      const sweptRoutes = sweepEntry?.routes ?? []

      if (!sweepEntry) {
        artifact.apps[app] = {
          type: type ?? 'unknown',
          sweptRoutes: [],
          enumeratedRoutes: enumeratedIds,
          results: {},
          coverage: {
            swept: 0,
            enumerated: enumeratedIds.length,
            uncovered: enumeratedIds,
            reason: 'no entry in scripts/a11y-routes.json',
          },
        }
        artifact.totals.uncovered += enumeratedIds.length
        console.log(
          `\n==> ${app} — NO SWEEP ENTRY: all ${enumeratedIds.length} enumerated routes count as uncovered` +
            `\n    add the app to scripts/a11y-routes.json (type: ${type ?? '?'})`,
        )
        continue
      }

      console.log(
        `\n==> ${app} — ${sweptRoutes.length} sweep-list routes, ${enumeratedIds.length} enumerated`,
      )
      const server = await serveApp(app, PORTS[app])

      const results = {}
      const covered = new Set()
      const appTotals = { critical: 0, serious: 0, moderate: 0, minor: 0 }
      try {
        for (const locale of locales) {
          const context = await browser.newContext(deviceName ? devices[deviceName] : {})
          if (type === 'spa' && locale !== 'en') {
            // SPAs negotiate locale from this cookie; SvelteKit apps use the URL prefix.
            await context.addCookies([
              { name: 'sanvi_locale', value: locale, domain: 'localhost', path: '/' },
            ])
          }
          const page = await context.newPage()

          for (const route of sweptRoutes) {
            const urlPath =
              type === 'sveltekit' && locale !== 'en'
                ? `/${locale}${route === '/' ? '' : route}`
                : route
            let entry
            try {
              await page.goto(`http://localhost:${PORTS[app]}${urlPath}`, {
                waitUntil: 'load',
                timeout: 20_000,
              })
              const axeResult = await new AxeBuilder({ page }).analyze()
              entry = { url: urlPath, locale, ...pageResult(axeResult.violations) }
              covered.add(route)
            } catch (error) {
              entry = { url: urlPath, locale, error: error.message.split('\n')[0] }
            }
            results[`${route} [${locale}]`] = entry
            if (entry.findings) {
              for (const finding of entry.findings) {
                if (finding.impact in appTotals) appTotals[finding.impact] += finding.nodes
              }
            }
          }
          await context.close()
        }
      } finally {
        server.stop()
      }

      // Coverage: enumerated definitions minus what actually got an axe entry.
      const uncovered = enumeratedIds.filter((id) => !covered.has(id))
      artifact.apps[app] = {
        type,
        sweptRoutes,
        enumeratedRoutes: enumeratedIds,
        results,
        coverage: { swept: covered.size, enumerated: enumeratedIds.length, uncovered },
      }
      artifact.totals.uncovered += uncovered.length
      for (const severity of Object.keys(appTotals))
        artifact.totals[severity] += appTotals[severity]

      console.log(
        `  swept ${covered.size}/${sweptRoutes.length} across ${locales.join('/')} — ` +
          `critical ${appTotals.critical}, serious ${appTotals.serious}, moderate ${appTotals.moderate}, minor ${appTotals.minor}` +
          (uncovered.length > 0
            ? `\n  UNCOVERED (${uncovered.length}): ${uncovered.join(', ')}`
            : ''),
      )
    }
  } finally {
    await browser.close()
    mockApi?.stop()
  }

  return artifact
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const artifact = await sweepA11y({ apps: args.apps, locales: args.locales })
  writeFileSync(args.out, `${JSON.stringify(artifact, null, 2)}\n`)
  console.log(`\nArtifact: ${args.out}`)
  if (artifact.totals.uncovered > 0) {
    console.log(`Route coverage: ${artifact.totals.uncovered} route(s) with no axe entry`)
    if (args.enforceCoverage) {
      console.error('check:a11y: --enforce-coverage is set — failing on uncovered routes')
      process.exit(1)
    }
  }
  console.log('report-only — axe is not blocking until TASK-027')
}

if (isMainEntryPoint(import.meta.url)) {
  await main()
}
