#!/usr/bin/env node
/**
 * `pnpm check:a11y [--report-only] [--apps a,b] [--locales en,ja] [--themes light,dark] [--out <file>]`
 *
 * The axe sweep (TASK-031 reporting-only; **blocking since TASK-027**): axe
 * across every route of all four apps, both locales, both themes, under the
 * pinned profile in `scripts/perf-profiles.json`. Blocking means: zero
 * serious or critical findings, every enumerated route actually swept, and
 * every page's axe run completing — a page whose sweep errored is a missing
 * entry, not a pass. `--report-only` keeps the escape hatch for local runs.
 *
 * Route coverage is asserted alongside the findings, because coverage is what
 * makes the gate survive phases 09 and 10 adding routes: the routes actually
 * swept come from the committed `scripts/a11y-routes.json`, while coverage is
 * computed against the routes **enumerated live from each app's route
 * definitions** (`@sanvi/lint-gates/routes`). A route that lands without a
 * sweep-list entry shows up as uncovered — the conscious act of adding it to
 * the sweep list is the same act as budgeting it. The artifact records both
 * lists so the diff is auditable.
 *
 * Pages are swept as the harness can serve them, which since TASK-027 is the
 * real content: the SPAs boot against `scripts/lib/spa-mock-api.mjs` (the
 * route-mock port of their e2e backends) so routes render past the login
 * redirect, and the storefront's self-service forms render against
 * `scripts/lib/kratos-mock.mjs` on the preview's `PUBLIC_KRATOS_ORIGIN`.
 * Route data endpoints beyond the boot set are not mocked — their designed
 * async states render and are swept like any other page.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { evaluateGate } from '@sanvi/lint-gates/check-a11y-gate'
import { loadBudgets } from '@sanvi/lint-gates/check-budget'
import { findWorkspaceRoot, loadPerfProfiles } from '@sanvi/lint-gates/perf-profiles'
import { listRoutes } from '@sanvi/lint-gates/routes'
import { isMainEntryPoint } from '@sanvi/lint-gates/walk-files'
import { startKratosMock } from './lib/kratos-mock.mjs'
import { serveApp, startStorefrontMockApi } from './lib/serving.mjs'
import { mockSpaApi } from './lib/spa-mock-api.mjs'

const require = createRequire(import.meta.url)
const ROOT = findWorkspaceRoot()
const PROFILES = loadPerfProfiles({ root: ROOT })

// Ports live in lighthouserc.cjs APPS — the serving topology has one home.
// A local copy here drifted the moment someone changed a port in the config.
const { APPS } = require(join(ROOT, 'lighthouserc.cjs'))
const PORTS = Object.fromEntries(Object.entries(APPS).map(([name, cfg]) => [name, cfg.port]))

/**
 * How long a page gets to finish hydrating / settling its async states after
 * `load` before axe analyzes. The TASK-021 "sweep-timing artifact" — 12
 * phantom serious findings on `ssr=false` routes — was exactly this wait
 * missing: axe analyzed the pre-hydration shell. `networkidle` catches the
 * network tail; the fixed delay catches render work after it.
 */
const SETTLE_NETWORKIDLE_MS = 5_000
const SETTLE_LOADING_MS = 3_000
const SETTLE_EXTRA_MS = 400

function parseArgs(argv) {
  const args = {
    reportOnly: false,
    apps: Object.keys(PORTS),
    locales: PROFILES.harnesses.axe.locales,
    themes: PROFILES.harnesses.axe.themes ?? ['light', 'dark'],
    out: join(ROOT, 'benchmarks', 'frontend', 'axe.json'),
  }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--report-only') args.reportOnly = true
    else if (argv[i] === '--apps') args.apps = argv[++i].split(',')
    else if (argv[i] === '--locales') args.locales = argv[++i].split(',')
    else if (argv[i] === '--themes') args.themes = argv[++i].split(',')
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
 * Sweeps axe across the given apps × locales × themes and returns the
 * artifact object (not written to disk — callers decide where it lands).
 * @param {{ apps: string[], locales: string[], themes?: string[] }} options
 */
export async function sweepA11y({ apps, locales, themes = ['light', 'dark'] }) {
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
      harness: { ...PROFILES.harnesses.axe, themes },
      device: deviceName ?? 'desktop-chromium',
    },
    buildSha: null,
    apps: {},
    totals: { critical: 0, serious: 0, moderate: 0, minor: 0, uncovered: 0, errors: 0 },
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
  // The storefront's self-service pages fetch their flows from
  // PUBLIC_KRATOS_ORIGIN (:4433 in the preview config) — without this mock
  // they render the 500 error page and the sweep covers the wrong thing.
  const kratosMock = apps.includes('storefront') ? await startKratosMock() : null
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
      let appErrors = 0
      try {
        for (const locale of locales) {
          for (const theme of themes) {
            const context = await browser.newContext(deviceName ? devices[deviceName] : {})
            if (type === 'spa' && locale !== 'en') {
              // SPAs negotiate locale from this cookie; SvelteKit apps use the URL prefix.
              await context.addCookies([
                { name: 'sanvi_locale', value: locale, domain: 'localhost', path: '/' },
              ])
            }
            if (type === 'spa') {
              // Authenticated sweep: boot the console past its login redirect
              // so routes render their real content (TASK-027 step 1).
              mockSpaApi(context, app)
            }
            if (theme === 'dark') {
              // Both dark mechanisms: design-tokens keys off `[data-theme="dark"]`,
              // tenant theme css_vars split light/dark on the media query.
              await context.addInitScript(() => {
                document.documentElement.dataset.theme = 'dark'
              })
            }
            const page = await context.newPage()
            if (theme === 'dark') {
              // emulateMedia is a page-level API (not on BrowserContext).
              await page.emulateMedia({ colorScheme: 'dark' })
            }

            for (const route of sweptRoutes) {
              const urlPath =
                type === 'sveltekit' && locale !== 'en'
                  ? `/${locale}${route === '/' ? '' : route}`
                  : route
              const key = `${route} [${locale}/${theme}]`
              let entry
              try {
                await page.goto(`http://localhost:${PORTS[app]}${urlPath}`, {
                  waitUntil: 'load',
                  timeout: 20_000,
                })
                await page
                  .waitForLoadState('networkidle', { timeout: SETTLE_NETWORKIDLE_MS })
                  .catch(() => {})
                // TASK-023's async-state markers double as the settle signal:
                // a page still in `loading` renders its spinner branch, not
                // its content, and sweeping the spinner sweeps the wrong
                // thing. Bounded — a wedged loader is swept as-is.
                await page
                  .waitForFunction(() => !document.querySelector('[data-async-state="loading"]'), {
                    timeout: SETTLE_LOADING_MS,
                  })
                  .catch(() => {})
                await page.waitForTimeout(SETTLE_EXTRA_MS)
                const axeResult = await new AxeBuilder({ page }).analyze()
                entry = { url: urlPath, locale, theme, ...pageResult(axeResult.violations) }
                covered.add(route)
              } catch (error) {
                entry = { url: urlPath, locale, theme, error: error.message.split('\n')[0] }
                appErrors += 1
              }
              results[key] = entry
              if (entry.findings) {
                for (const finding of entry.findings) {
                  if (finding.impact in appTotals) appTotals[finding.impact] += finding.nodes
                }
              }
            }
            await context.close()
          }
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
      artifact.totals.errors += appErrors
      for (const severity of Object.keys(appTotals))
        artifact.totals[severity] += appTotals[severity]

      console.log(
        `  swept ${covered.size}/${sweptRoutes.length} across ${locales.join('/')} × ${themes.join('/')}` +
          ` — critical ${appTotals.critical}, serious ${appTotals.serious}, moderate ${appTotals.moderate}, minor ${appTotals.minor}` +
          (appErrors > 0 ? `, ERRORED PAGES ${appErrors}` : '') +
          (uncovered.length > 0
            ? `\n  UNCOVERED (${uncovered.length}): ${uncovered.join(', ')}`
            : ''),
      )
    }
  } finally {
    await browser.close()
    mockApi?.stop()
    kratosMock?.stop()
  }

  return artifact
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const artifact = await sweepA11y({
    apps: args.apps,
    locales: args.locales,
    themes: args.themes,
  })
  writeFileSync(args.out, `${JSON.stringify(artifact, null, 2)}\n`)
  console.log(`\nArtifact: ${args.out}`)
  const gate = evaluateGate(artifact)
  if (args.reportOnly) {
    console.log(
      `report-only — gate: ${gate.ok ? 'would pass' : `would FAIL: ${gate.failures.join('; ')}`}`,
    )
    return
  }
  if (!gate.ok) {
    console.error(`check:a11y: BLOCKING — ${gate.failures.join('; ')}`)
    process.exit(1)
  }
  console.log(
    'check:a11y: gate passed (no serious/critical findings, full route coverage, no sweep errors)',
  )
}

if (isMainEntryPoint(import.meta.url)) {
  await main()
}
