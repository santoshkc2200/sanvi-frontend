#!/usr/bin/env node
/**
 * Enforces the JS bundle budgets from `docs/architecture-overview.md` §6:
 *
 *   | Surface                        | Budget            |
 *   |---------------------------------|-------------------|
 *   | Storefront initial JS (gzip)    | ≤ 100 KB          |
 *   | Admin initial JS (gzip)         | ≤ 250 KB          |
 *   | Any single route chunk          | ≤ 50 KB           |
 *
 * Phase 11 (TASK-031) adds the **per-route** dimension: an app total inside
 * budget can hide one route at four times its share, and that route is
 * somebody's landing page. Per-app values (including the per-route budget)
 * live in `scripts/budgets.json`, seeded from the current build plus a small
 * margin; TASK-022 tightens them to the targets above.
 *
 * Two invocation shapes:
 *
 *   sanvi-check-budget --app <name> [--report-only]      whole workspace view:
 *       initial + total + per-route table for that app, from budgets.json
 *   sanvi-check-budget --all [--report-only]             every app in budgets.json
 *   sanvi-check-budget --dir <dir> [--initial-kb N] [--chunk-kb N]
 *       legacy single-directory shape (still what the unit tests exercise)
 *
 * `--report-only` prints the same table but never fails the process — for
 * exploratory runs against unbudgeted branches. Since TASK-022 the default
 * run blocks on every dimension: initial, per-chunk, per-route, SPA initial
 * (manifest closure), and the Japanese font preloads.
 *
 * The *initial* budget is precise for SvelteKit's `adapter-node` output
 * (`_app/immutable/entry/` + `_app/immutable/chunks/`, summed and checked
 * — `_app/immutable/nodes/` is per-route code). For a Vite SPA build the
 * initial set is the manifest entry's static import closure (see
 * `spaInitialKb`) — what the emitted script + modulepreload chain loads at
 * boot.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import { gzipSync } from 'node:zlib'
import { findWorkspaceRoot } from './perf-profiles.mjs'
import { listRoutes } from './routes.mjs'
import { isDirectory, isMainEntryPoint, walkFiles } from './walk-files.mjs'

function gzipSizeKb(filePath) {
  const content = readFileSync(filePath)
  return gzipSync(content).length / 1024
}

function parseArgs(argv) {
  const args = {
    dir: undefined,
    app: undefined,
    all: false,
    reportOnly: false,
    initialKb: 100,
    chunkKb: 50,
    routeKb: undefined,
  }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--dir') args.dir = argv[++i]
    else if (argv[i] === '--app') args.app = argv[++i]
    else if (argv[i] === '--all') args.all = true
    else if (argv[i] === '--report-only') args.reportOnly = true
    else if (argv[i] === '--initial-kb') args.initialKb = Number(argv[++i])
    else if (argv[i] === '--chunk-kb') args.chunkKb = Number(argv[++i])
    else if (argv[i] === '--route-kb') args.routeKb = Number(argv[++i])
  }
  return args
}

/**
 * Per-app budget config from `scripts/budgets.json` — the single place a
 * budget number is written. Values are KB, gzip, derived from the current
 * build plus a small margin (TASK-031); TASK-022 tightened them to the
 * architecture targets and made every dimension blocking (initial JS,
 * per-route JS, SPA initial via the Vite manifest, and the Japanese font
 * preloads).
 */
export function loadBudgets({ root = findWorkspaceRoot() } = {}) {
  const file = join(root, 'scripts', 'budgets.json')
  return JSON.parse(readFileSync(file, 'utf8'))
}

/**
 * SPA initial JS (gzip KB): the entry chunk plus its transitive static
 * import closure from the Vite build manifest — exactly the modules the
 * emitted `<script src>` and its `modulepreload` chain load before any
 * route code runs. TASK-022's answer to "the SPA initial convention": the
 * manifest is the build's own declaration of the boot set, so the gate
 * measures what the browser actually fetches, not a directory-shape guess.
 * `null` when the manifest is missing or has no entry — reported as
 * unmeasured, never guessed.
 */
export function spaInitialKb(buildDir) {
  const manifestPath = join(buildDir, '.vite', 'manifest.json')
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    const entryKey = Object.keys(manifest).find((key) => manifest[key]?.isEntry)
    if (!entryKey) return null
    const seen = new Set()
    const queue = [entryKey]
    while (queue.length > 0) {
      const key = queue.shift()
      if (seen.has(key) || !manifest[key]?.file) continue
      seen.add(key)
      for (const imp of manifest[key].imports ?? []) queue.push(imp)
    }
    let kb = 0
    for (const key of seen) {
      kb += gzipSizeKb(join(buildDir, manifest[key].file))
    }
    return kb
  } catch {
    return null
  }
}

/**
 * Font preloads (TASK-022): the Japanese subsets the ja layout preloads,
 * budgeted as their own line — a single global font number would hide the
 * one case that is hard. Raw (not gzip'd) file sizes: woff2 is already
 * compressed, so gzip arithmetic on it measures nothing.
 */
export function fontPreloadResult({ config, root }) {
  const files = (config?.files ?? []).map((rel) => {
    const abs = join(root, rel)
    let kb = null
    try {
      kb = readFileSync(abs).length / 1024
    } catch {
      // missing file — reported as missing, never dropped
    }
    return { file: rel, kb }
  })
  const measured = files.filter((f) => f.kb !== null)
  const totalKb = measured.length === files.length && files.length > 0
    ? measured.reduce((sum, f) => sum + f.kb, 0)
    : null
  return {
    label: config?.label ?? 'font preloads',
    files,
    totalKb: totalKb === null ? null : Number(totalKb.toFixed(2)),
    budgetKb: config?.budgetKb,
    ok: totalKb !== null && config?.budgetKb !== undefined && totalKb <= config.budgetKb,
  }
}

function isSvelteKitClientOutput(dir) {
  return isDirectory(join(dir, '_app', 'immutable'))
}

/**
 * Per-route gzipped sizes. SvelteKit routes map to their manifest leaf node's
 * client chunk (`_app/immutable/nodes/<n>.<hash>.js`); SPA routes to the lazy
 * component chunk the Vite manifest (`manifest: true`) maps their source file
 * to. A route whose chunk is missing gets a
 * null size — reported as missing, never silently dropped: a route that
 * stopped producing a chunk is exactly the kind of thing the table exists to surface.
 *
 * @returns {{ id: string, kb: number|null }[]}
 */
export function routeSizes(appRoot, type, buildDir) {
  const routes = listRoutes(appRoot, type)
  if (!routes) return []

  return routes.map((route) => {
    if (type === 'sveltekit') {
      if (route.leaf === null) return { id: route.id, kb: null }
      const nodesDir = join(buildDir, '_app', 'immutable', 'nodes')
      let kb = null
      try {
        for (const name of readdirSync(nodesDir)) {
          // `<leaf>.<hash>.js` — match the leaf index exactly (12. not 1.)
          if (new RegExp(`^${route.leaf}\\.[A-Za-z0-9_-]+\\.js$`).test(name)) {
            kb = gzipSizeKb(join(nodesDir, name))
            break
          }
        }
      } catch {
        // nodes dir missing — stays null, reported as missing
      }
      return { id: route.id, kb }
    }

    // SPA: source file → chunk via the Vite manifest (`manifest: true` in the
    // app's vite config). Component basenames are ambiguous — root and
    // advertising each have a `Dashboard-*.js` — so a missing manifest means
    // *no number*, never a guess: a reported null is honest, a wrong chunk's
    // size feeds the gate a fiction.
    if (!route.sourcePath) return { id: route.id, kb: null }
    const manifestPath = join(buildDir, '.vite', 'manifest.json')
    let kb = null
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
      // Manifest keys are always posix-relative — `join` would emit `\` on
      // Windows and every route would read as chunk-not-found.
      const entry = manifest[`src/${route.sourcePath}`]
      if (entry?.file) kb = gzipSizeKb(join(buildDir, entry.file))
    } catch {
      // manifest missing/unparseable — stays null, reported as missing
    }
    return { id: route.id, kb }
  })
}

/**
 * @param {{ dir: string, initialKb: number, chunkKb: number }} args
 */
export function runBudgetCheck({ dir, initialKb, chunkKb }) {
  if (!isDirectory(dir)) {
    return {
      ok: true,
      skipped: true,
      message: `(skipped — ${dir} does not exist; run \`build\` first)`,
      totalKb: 0,
      initialKbTotal: null,
      initialKb,
      chunkKb,
      oversizedChunks: [],
      svelteKit: false,
    }
  }

  const jsFiles = [...walkFiles(dir, (name) => name.endsWith('.js'))]
  const sizes = jsFiles.map((file) => ({ file, kb: gzipSizeKb(file) }))

  const oversizedChunks = sizes.filter((s) => s.kb > chunkKb)

  const svelteKit = isSvelteKitClientOutput(dir)
  let initialKbTotal = null
  if (svelteKit) {
    initialKbTotal = sizes
      .filter((s) => {
        const parts = s.file.split(sep)
        const immutableIndex = parts.indexOf('immutable')
        const bucket = immutableIndex === -1 ? undefined : parts[immutableIndex + 1]
        return bucket === 'entry' || bucket === 'chunks'
      })
      .reduce((sum, s) => sum + s.kb, 0)
  }

  const totalKb = sizes.reduce((sum, s) => sum + s.kb, 0)
  const initialOverBudget = initialKbTotal !== null && initialKbTotal > initialKb

  return {
    ok: oversizedChunks.length === 0 && !initialOverBudget,
    skipped: false,
    dir,
    totalKb,
    initialKbTotal,
    initialKb,
    chunkKb,
    oversizedChunks,
    svelteKit,
  }
}

/**
 * Budget check for one app from `scripts/budgets.json`, with the per-route
 * dimension added.
 *
 * `ok` — the process-failing verdict — covers every dimension since
 * TASK-022 turned the gate blocking: initial JS (SvelteKit's
 * `_app/immutable` convention, or the Vite-manifest closure for SPAs), the
 * flat per-chunk budget, the per-route budget, and (via `fontsOk` on the
 * workspace-level report) the Japanese font preload budget. The baseline
 * first existed (TASK-031's rc.1, tightened by rc.3); the gate now blocks.
 *
 * @param {{ name: string, config: { type: 'sveltekit'|'spa', initialKb: number, chunkKb: number, routeKb: number }, root: string }} params
 */
export function runAppBudgetCheck({ name, config, root }) {
  const appRoot = join(root, 'apps', name)
  const buildDir = join(appRoot, config.type === 'sveltekit' ? join('build', 'client') : 'dist')
  const base = runBudgetCheck({
    dir: buildDir,
    initialKb: config.initialKb,
    chunkKb: config.chunkKb,
  })

  if (base.skipped) {
    return {
      ...base,
      name,
      routes: [],
      routeKb: config.routeKb,
      routesMissing: 0,
      routeOk: true,
      fontsOk: true,
    }
  }

  // The SPA initial convention TASK-022 added: manifest closure when the
  // directory shape can't express it.
  let initialKbTotal = base.initialKbTotal
  if (initialKbTotal === null && !base.svelteKit) {
    initialKbTotal = spaInitialKb(buildDir)
  }

  const sizes = routeSizes(appRoot, config.type, buildDir)
  const routes = sizes.map((r) => ({ ...r, over: r.kb !== null && r.kb > config.routeKb }))
  const routesMissing = routes.filter((r) => r.kb === null).length
  const anyRouteOver = routes.some((r) => r.over)
  const initialOverBudget = initialKbTotal !== null && initialKbTotal > config.initialKb

  return {
    ...base,
    initialKbTotal,
    ok: base.ok && !initialOverBudget,
    name,
    routes,
    routeKb: config.routeKb,
    routesMissing,
    routeOk: !anyRouteOver && routesMissing === 0,
  }
}

export function formatAppReport(result) {
  if (result.skipped) return result.message

  const lines = [
    `==> ${result.name} (${result.svelteKit ? 'sveltekit' : 'spa'})`,
    `Build output: ${result.dir}`,
    `Total JS (gzip): ${result.totalKb.toFixed(1)} KB`,
  ]

  if (result.initialKbTotal !== null) {
    const status = result.initialKbTotal > result.initialKb ? '✗' : '✓'
    lines.push(
      `${status} Initial JS (gzip): ${result.initialKbTotal.toFixed(1)} KB / ${result.initialKb} KB budget`,
    )
  } else {
    lines.push(
      `  ✗ Initial JS: unmeasured (no _app/immutable convention and no Vite manifest with an entry) — the gate cannot verify this build shape.`,
    )
  }

  lines.push(`Per-route (budget ${result.routeKb} KB):`)
  for (const route of result.routes) {
    if (route.kb === null) {
      lines.push(`  ✗ ${route.id} — chunk not found in build output`)
    } else if (route.over) {
      lines.push(
        `  ✗ ${route.id}: ${route.kb.toFixed(1)} KB — over by ${(route.kb - result.routeKb).toFixed(2)} KB`,
      )
    } else {
      lines.push(`  ✓ ${route.id}: ${route.kb.toFixed(1)} KB`)
    }
  }
  if (result.routes.length === 0) {
    lines.push('  (no routes enumerated — was the app built?)')
  }

  // The flat chunk budget is blocking via runBudgetCheck's `ok` for both build
  // shapes, and an SPA's initial JS is unmeasured — without this listing the
  // gate exits 1 having printed nothing that names a failing chunk.
  if (result.oversizedChunks.length > 0) {
    lines.push(`✗ ${result.oversizedChunks.length} chunk(s) over the ${result.chunkKb} KB budget:`)
    for (const chunk of result.oversizedChunks) {
      lines.push(`    ${chunk.file}: ${chunk.kb.toFixed(1)} KB`)
    }
  }

  return lines.join('\n')
}

function formatReport(result) {
  if (result.skipped) return result.message

  const lines = [`Build output: ${result.dir}`, `Total JS (gzip): ${result.totalKb.toFixed(1)} KB`]

  if (result.initialKbTotal !== null) {
    const status = result.initialKbTotal > result.initialKb ? '✗' : '✓'
    lines.push(
      `${status} Initial JS (entry+chunks, gzip): ${result.initialKbTotal.toFixed(1)} KB / ${result.initialKb} KB budget`,
    )
  } else {
    lines.push(
      `  Initial JS: not measured for this build shape (no _app/immutable convention) — total reported above for visibility only.`,
    )
  }

  if (result.oversizedChunks.length > 0) {
    lines.push(`✗ ${result.oversizedChunks.length} chunk(s) over the ${result.chunkKb} KB budget:`)
    for (const chunk of result.oversizedChunks) {
      lines.push(`    ${chunk.file}: ${chunk.kb.toFixed(1)} KB`)
    }
  } else {
    lines.push(`✓ Every chunk is under the ${result.chunkKb} KB budget`)
  }

  return lines.join('\n')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const root = findWorkspaceRoot()

  if (args.app || args.all) {
    const budgets = loadBudgets({ root })
    const names = args.all ? Object.keys(budgets.apps) : [args.app]
    const unknown = names.filter((name) => !budgets.apps[name])
    if (unknown.length > 0) {
      console.error(`check:budget: unknown app(s) in budgets.json: ${unknown.join(', ')}`)
      process.exit(2)
    }

    let failed = false
    for (const name of names) {
      const result = runAppBudgetCheck({ name, config: budgets.apps[name], root })
      console.log(formatAppReport(result))
      if (!result.ok || !result.routeOk) failed = true
    }

    // Japanese font preloads — their own lines, blocking (TASK-022): the
    // one hard locale's payload must not hide inside a global number.
    if (budgets.fonts) {
      for (const [name, config] of Object.entries(budgets.fonts)) {
        const fonts = fontPreloadResult({ config, root })
        const status = fonts.ok ? '✓' : '✗'
        const total = fonts.totalKb === null ? 'unmeasured (file missing)' : `${fonts.totalKb.toFixed(1)} KB`
        console.log(`${status} ${name} font preloads — ${fonts.label}: ${total} / ${fonts.budgetKb} KB budget`)
        for (const file of fonts.files) {
          console.log(
            `    ${file.kb === null ? '✗ missing' : `${file.kb.toFixed(1)} KB`}  ${file.file}`,
          )
        }
        if (!fonts.ok) failed = true
      }
    }

    if (failed && !args.reportOnly) process.exit(1)
    if (args.reportOnly && failed)
      console.log('\n(report-only — nothing here fails the build in this mode)')
    return
  }

  if (!args.dir) {
    console.error(
      'Usage: sanvi-check-budget (--app <name> | --all) [--report-only] | --dir <build-output-dir> [--initial-kb N] [--chunk-kb N] [--route-kb N] [--report-only]',
    )
    process.exit(2)
  }

  const result = runBudgetCheck(args)
  console.log(formatReport(result))

  if (!result.ok && !result.skipped && !args.reportOnly) process.exit(1)
  if (args.reportOnly && !result.ok && !result.skipped)
    console.log('\n(report-only — nothing here fails the build in this mode)')
}

if (isMainEntryPoint(import.meta.url)) {
  await main()
}
